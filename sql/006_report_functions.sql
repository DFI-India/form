-- Grouping and totalling for the report builder.
--
-- The REST API has aggregate functions disabled (Supabase's default, and a
-- sensible one), so counts and sums run through this function instead. It does
-- the work inside Postgres rather than shipping every row to the server to be
-- counted in JavaScript, which is how the old reports worked.
--
-- Every identifier is checked against the view's real columns before it reaches
-- the query, and values are passed as parameters, never concatenated. The
-- function is SECURITY INVOKER, so row-level security still applies exactly as
-- it would on a plain select.
--
-- Safe to re-run.

begin;

-- Only these may be reported on. A view not listed here cannot be reached,
-- whatever the caller sends.
create or replace function public.report_source_allowed(p_view text)
returns boolean language sql immutable as $$
  select p_view in ('v_child_report', 'v_vocational_report', 'v_computer_report');
$$;

create or replace function public.report_group(
  p_view       text,
  p_dimensions text[]  default '{}',
  p_measures   jsonb   default '[]'::jsonb,
  p_filters    jsonb   default '[]'::jsonb,
  p_order      jsonb   default '[]'::jsonb,
  p_limit      integer default 1000
)
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  v_cols        text[];
  v_select      text[] := '{}';
  v_group       text[] := '{}';
  v_where       text[] := '{}';
  v_order       text[] := '{}';
  v_args        text[] := '{}';
  v_sql         text;
  v_result      jsonb;
  v_dim         text;
  v_measure     jsonb;
  v_filter      jsonb;
  v_sort        jsonb;
  v_fn          text;
  v_field       text;
  v_alias       text;
  v_op          text;
  v_type        text;
  v_arg_n       int := 0;
begin
  if not public.report_source_allowed(p_view) then
    raise exception 'Unknown report source: %', p_view using errcode = '22023';
  end if;

  select array_agg(column_name::text)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = p_view;

  if v_cols is null then
    raise exception 'The report views are not installed. Run sql/005_report_views.sql.'
      using errcode = '42P01';
  end if;

  -- ------------------------------------------------------------ dimensions --
  foreach v_dim in array coalesce(p_dimensions, '{}') loop
    if not (v_dim = any(v_cols)) then
      raise exception 'No such field: %', v_dim using errcode = '22023';
    end if;
    v_select := v_select || format('%I', v_dim);
    v_group  := v_group  || format('%I', v_dim);
  end loop;

  -- -------------------------------------------------------------- measures --
  for v_measure in select * from jsonb_array_elements(coalesce(p_measures, '[]'::jsonb)) loop
    v_fn    := lower(coalesce(v_measure->>'fn', 'count'));
    v_field := v_measure->>'field';
    v_alias := coalesce(v_measure->>'alias', v_fn || coalesce('_' || v_field, ''));

    if v_fn not in ('count', 'count_distinct', 'sum', 'avg', 'min', 'max') then
      raise exception 'Unsupported measure: %', v_fn using errcode = '22023';
    end if;
    if v_field is not null and not (v_field = any(v_cols)) then
      raise exception 'No such field: %', v_field using errcode = '22023';
    end if;

    v_select := v_select || case
      when v_fn = 'count' and v_field is null then format('count(*) as %I', v_alias)
      when v_fn = 'count'                     then format('count(%I) as %I', v_field, v_alias)
      when v_fn = 'count_distinct'            then format('count(distinct %I) as %I', v_field, v_alias)
      -- Rounded so an average lands as a readable number rather than 18 decimals.
      when v_fn = 'avg'                       then format('round(avg(%I)::numeric, 2) as %I', v_field, v_alias)
      else format('%s(%I) as %I', v_fn, v_field, v_alias)
    end;
  end loop;

  if array_length(v_select, 1) is null then
    v_select := array['count(*) as count'];
  end if;

  -- --------------------------------------------------------------- filters --
  for v_filter in select * from jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) loop
    v_field := v_filter->>'field';
    v_op    := lower(coalesce(v_filter->>'op', 'eq'));

    if v_op not in ('eq','neq','gt','gte','lt','lte','contains','in','between','is_null','not_null') then
      raise exception 'Unsupported filter: %', v_op using errcode = '22023';
    end if;

    -- The column's real type, straight from the catalogue. Comparing a number
    -- or a date as text would order 9 after 10, so the value is cast to the
    -- column's type rather than the other way round.
    select data_type into v_type
      from information_schema.columns
     where table_schema = 'public' and table_name = p_view and column_name = v_field;

    if v_type is null then
      raise exception 'No such field: %', v_field using errcode = '22023';
    end if;

    -- Enums and arrays report a type name that cannot be cast to; compare
    -- those as text. The report views have none today, but a later column
    -- shouldn't be able to break the function.
    if v_type in ('USER-DEFINED', 'ARRAY') then
      v_type := 'text';
    end if;

    -- Values are collected into one text[] passed as $1, and referenced as
    -- $1[n]. Nothing a person types becomes part of the SQL text.
    if v_op in ('is_null', 'not_null') then
      v_where := v_where || format('%I is %s null', v_field, case when v_op = 'is_null' then '' else 'not' end);

    elsif v_op = 'between' then
      v_args  := v_args || (v_filter->>'value') || (v_filter->>'value2');
      v_arg_n := v_arg_n + 2;
      v_where := v_where || format('%I between ($1[%s])::%s and ($1[%s])::%s',
                                   v_field, v_arg_n - 1, v_type, v_arg_n, v_type);

    elsif v_op = 'in' then
      v_args  := v_args || array_to_string(
                   array(select jsonb_array_elements_text(coalesce(v_filter->'value', '[]'::jsonb))), E'\u0001');
      v_arg_n := v_arg_n + 1;
      v_where := v_where || format('%I::text = any(string_to_array($1[%s], E''\u0001''))', v_field, v_arg_n);

    elsif v_op = 'contains' then
      v_args  := v_args || (v_filter->>'value');
      v_arg_n := v_arg_n + 1;
      v_where := v_where || format('%I::text ilike ''%%'' || $1[%s] || ''%%''', v_field, v_arg_n);

    else
      v_args  := v_args || (v_filter->>'value');
      v_arg_n := v_arg_n + 1;
      v_where := v_where || format('%I %s ($1[%s])::%s', v_field,
        case v_op when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>'
                  when 'gte' then '>=' when 'lt' then '<' else '<=' end,
        v_arg_n, v_type);
    end if;
  end loop;

  -- ----------------------------------------------------------------- order --
  for v_sort in select * from jsonb_array_elements(coalesce(p_order, '[]'::jsonb)) loop
    v_field := v_sort->>'field';
    -- Sorting by a measure's alias is legitimate, so a name that is not a
    -- column is allowed only when it is one this call just created.
    if v_field = any(v_cols) or exists (
      select 1 from jsonb_array_elements(coalesce(p_measures, '[]'::jsonb)) m
       where coalesce(m->>'alias', '') = v_field
    ) then
      v_order := v_order || format('%I %s nulls last', v_field,
                                   case when lower(coalesce(v_sort->>'dir', 'asc')) = 'desc' then 'desc' else 'asc' end);
    else
      raise exception 'Cannot sort by %', v_field using errcode = '22023';
    end if;
  end loop;

  -- ------------------------------------------------------------------ run --
  v_sql := format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select %s from public.%I',
                  array_to_string(v_select, ', '), p_view);

  if array_length(v_where, 1) > 0 then
    v_sql := v_sql || ' where ' || array_to_string(v_where, ' and ');
  end if;
  if array_length(v_group, 1) > 0 then
    v_sql := v_sql || ' group by ' || array_to_string(v_group, ', ');
  end if;
  if array_length(v_order, 1) > 0 then
    v_sql := v_sql || ' order by ' || array_to_string(v_order, ', ');
  end if;

  v_sql := v_sql || format(' limit %s) t', least(greatest(coalesce(p_limit, 1000), 1), 20000));

  execute v_sql into v_result using v_args;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

comment on function public.report_group is
  'Grouped counts and totals over the report views. Identifiers are checked against the view; values are bound as parameters.';

revoke all on function public.report_group(text, text[], jsonb, jsonb, jsonb, integer) from public;
grant execute on function public.report_group(text, text[], jsonb, jsonb, jsonb, integer) to authenticated;

commit;
