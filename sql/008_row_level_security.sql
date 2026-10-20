-- Row-level security for the record tables.
--
-- WHY THIS EXISTS
--
-- 007 took the grant away from the anonymous role, which stops the public key
-- reading anything. This is the layer underneath: it decides what a *signed-in*
-- person can reach. Without it, any account — a field volunteer included — can
-- read and change every row in the database by talking to the API directly,
-- whatever the screens allow.
--
-- HOW IT IS SHAPED
--
-- Every /api route in the app uses the service key, which ignores these
-- policies entirely. So nothing here can break a server route. What it governs
-- is the browser talking to Supabase directly: the volunteer entry form, the
-- resubmission of rejected records, and the screens that read tables straight.
--
-- The rule in one sentence: staff see and change everything, a volunteer sees
-- everything but may only change their own work, and only while it is still
-- pending or sent back.
--
-- That last clause matters. Volunteers fix rejected records, so they must be
-- able to update them. Once a record is Approved it stops being theirs to edit,
-- which is what makes approval mean something.
--
-- Narrowing what a volunteer can *read* to their own centre is the sensible
-- next step, but it needs testing with real accounts on each screen, so it is
-- deliberately not done here.
--
-- Safe to re-run: every policy is dropped and recreated.

begin;

-- ---------------------------------------------------------------- helpers --

-- Reads the caller's role. SECURITY DEFINER because the profiles table has its
-- own policies, and a policy that queried profiles directly would recurse.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'dfi_staff', 'dfi_field_staff', 'tech_support'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

revoke all on function public.current_app_role() from anon, public;
revoke all on function public.is_staff() from anon, public;
revoke all on function public.is_admin() from anon, public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------- the record tables ------
-- Same shape for each: read if signed in, insert as yourself, change your own
-- work while it is still open, staff may change anything.

do $$
declare
  t text;
  tables text[] := array[
    'Child_Data', 'childfmly', 'childsibling', 'childuniform', 'childleaving',
    'vocational_course', 'computer_course'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format($p$
      create policy %I on public.%I for select to authenticated using (true)
    $p$, t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format($p$
      create policy %I on public.%I for insert to authenticated
      with check (submitted_by = auth.uid() or submitted_by is null or public.is_staff())
    $p$, t || '_insert', t);

    -- A volunteer may correct their own row until it is approved.
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format($p$
      create policy %I on public.%I for update to authenticated
      using (
        public.is_staff()
        or (submitted_by = auth.uid() and coalesce(status, 'Pending') in ('Pending', 'Rejected'))
      )
      with check (
        public.is_staff()
        or (submitted_by = auth.uid() and coalesce(status, 'Pending') in ('Pending', 'Rejected'))
      )
    $p$, t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format($p$
      create policy %I on public.%I for delete to authenticated using (public.is_admin())
    $p$, t || '_delete', t);
  end loop;
end $$;

-- ------------------------------------------------------ approval queues ---
-- Volunteers create these when they submit; only staff decide them.

do $$
declare
  t text;
  tables text[] := array['child_approvals', 'vocational_training_approvals'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (true)$p$,
                   t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format($p$
      create policy %I on public.%I for insert to authenticated
      with check (submitted_by = auth.uid() or submitted_by is null or public.is_staff())
    $p$, t || '_insert', t);

    -- Deciding an approval is the whole point of the staff roles. This replaces
    -- the old policy that let any signed-in account approve anything.
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format($p$
      create policy %I on public.%I for update to authenticated
      using (public.is_staff()) with check (public.is_staff())
    $p$, t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (public.is_admin())$p$,
                   t || '_delete', t);
  end loop;
end $$;

-- ------------------------------------------------------------- profiles ---
-- Your own row, plus staff may read everyone. Only an admin changes a role,
-- which is what stops an account promoting itself.

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- -------------------------------------------- reference and audit data ----

alter table public.centre_data enable row level security;
drop policy if exists centre_data_select on public.centre_data;
create policy centre_data_select on public.centre_data for select to authenticated using (true);
drop policy if exists centre_data_write on public.centre_data;
create policy centre_data_write on public.centre_data for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.dfi_field_staff_assigned_eacs enable row level security;
drop policy if exists assigned_eacs_select on public.dfi_field_staff_assigned_eacs;
create policy assigned_eacs_select on public.dfi_field_staff_assigned_eacs for select to authenticated using (true);
drop policy if exists assigned_eacs_write on public.dfi_field_staff_assigned_eacs;
create policy assigned_eacs_write on public.dfi_field_staff_assigned_eacs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The log is written by the service key and read by admins. Nobody edits it.
alter table public.activity_logs enable row level security;
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (public.is_staff() or user_id = auth.uid());

commit;

-- CHECK IT WORKED
--
--   select tablename, rowsecurity
--     from pg_tables where schemaname = 'public'
--    order by rowsecurity, tablename;
--
-- Then sign in as a field volunteer and submit one child. That exercises the
-- insert policies on six tables at once. Then sign in as an admin and approve
-- it, which exercises the staff path.
--
-- TO UNDO one table while debugging:
--
--   alter table public.childfmly disable row level security;
