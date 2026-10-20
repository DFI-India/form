-- Close public read access to every table in the database.
--
-- WHAT IS WRONG
--
-- The "anon" key is public by design: it ships inside the JavaScript of
-- dfi-cms.vercel.app, so anyone who opens the site has it. It is supposed to be
-- useless on its own, with row-level security deciding what it can see.
--
-- Right now it is not useless. Using only that key, with nobody signed in, the
-- following are fully readable over the internet:
--
--   Child_Data                      25 of 25 rows   names, Aadhaar, photos
--   child_approvals                 99 of 99
--   childfmly                       21 of 21        parents, income, address
--   profiles                        10 of 10        every user account
--   computer_course                  3 of 3
--   vocational_course                4 of 4
--   vocational_training_approvals    7 of 7
--   dfi_field_staff_assigned_eacs    5 of 5
--   *_for_approval views            all rows        including sibling, uniform
--                                                   and leaving, whose base
--                                                   tables ARE protected
--
-- The *_for_approval and *_rejected_for_volunteer views are the subtle part.
-- A view runs with its creator's rights unless told otherwise, so those views
-- hand out rows from tables that row-level security is correctly protecting.
--
-- WHAT THIS DOES
--
-- Takes the grant away from "anon" rather than switching row-level security on
-- table by table. Nothing in this app needs anon to read a table: every screen
-- is behind a sign-in, and the one pre-login lookup (username to email) happens
-- server-side in /api/auth/signin with the service key. Removing the grant is
-- therefore surgical, immediate, and does not depend on getting a dozen
-- policies right under time pressure.
--
-- Signed-in users are unaffected: once someone signs in, PostgREST switches
-- their role from anon to authenticated, which this does not touch. The service
-- key used by every /api route is likewise unaffected.
--
-- Safe to re-run. To undo, see the last line of this file.

begin;

-- 1. No public reads, anywhere in the schema.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- 2. And nothing new granted to anon by default either, which is how this
--    happened: Supabase grants new objects to anon unless told not to.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- 3. Defence in depth: make the older views respect row-level security, so a
--    grant restored by hand later cannot reopen the tables underneath them.
--    (Views added in 005 already have this.)
do $$
declare v record;
begin
  for v in
    select table_name
      from information_schema.views
     where table_schema = 'public'
       and table_name like any (array['%_for_approval', '%_rejected_for_volunteer', '%_rejected_for_volunteers'])
  loop
    execute format('alter view public.%I set (security_invoker = on)', v.table_name);
  end loop;
end $$;

-- 4. The report function is for signed-in staff only.
revoke all on function public.report_group(text, text[], jsonb, jsonb, jsonb, integer) from anon, public;
grant execute on function public.report_group(text, text[], jsonb, jsonb, jsonb, integer) to authenticated;

commit;

-- CHECK IT WORKED
--
-- Run this, then reload the app and sign in. Every screen should behave exactly
-- as before, because signed-in users are the "authenticated" role, not "anon".
--
--   select count(*) as still_granted_to_anon
--     from information_schema.role_table_grants
--    where grantee = 'anon' and table_schema = 'public';
--
-- Expect 0.
--
-- TO UNDO (only if something legitimately broke):
--
--   grant select on all tables in schema public to anon;
