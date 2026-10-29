-- Read-only check. Changes nothing. Run this first and send me the output.
--
-- It answers three questions: what is already protected, what policies already
-- exist, and which migrations have been applied. That decides which parts of
-- ALL_IN_ONE.sql you actually need, and whether 008 would widen access that
-- somebody has already narrowed.

-- 1. Is the public role still shut out?
select
  (select count(*) from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public')                as anon_table_grants,
  (select count(*) from information_schema.role_routine_grants
    where grantee = 'anon' and routine_schema = 'public')              as anon_function_grants;
-- Expect 0 and 0. Anything above 0 means the public key can still reach that
-- many objects, and 007 is still needed.


-- 2. Which tables have row-level security switched on, and how many policies.
--    A table with security on and zero policies returns nothing to anyone,
--    which looks like data loss but is not.
select
  t.tablename,
  t.rowsecurity                                                        as security_on,
  count(p.policyname)                                                  as policies
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, t.rowsecurity
order by t.rowsecurity, count(p.policyname) desc, t.tablename;


-- 3. What the existing policies actually say. If this comes back empty,
--    nothing is written yet and 008 can be applied as it stands.
select tablename, policyname, cmd, roles::text, qual
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;


-- 4. Which migrations have landed already.
select
  to_regclass('public.import_staging')  is not null as has_001_import,
  to_regclass('public.districts')       is not null as has_002_places,
  (select count(*) from pg_tables where schemaname='public' and tablename='villages') > 0
    and coalesce((select count(*) from public.villages), 0) > 0        as has_003_seed,
  to_regclass('public.v_child_report')  is not null as has_005_views,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='public' and p.proname='report_group')      as has_006_function;
