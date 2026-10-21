-- =====================================================================
-- Debora Foundation India — full database setup, in one file
--
-- Paste the whole thing into the SQL editor and run it once.
--
-- Order matters. The lockdown runs first, so every table and view created
-- further down is born without public access rather than being opened and
-- then closed again.
--
-- Safe to run twice. Verified by running it twice in a row against a copy
-- of this schema.
--
-- 004 is deliberately absent: it repaired rows that only ever existed in
-- the old test data.
--
-- At the end it prints a row of counts. Expect districts 2, taluks 3,
-- panchayats 18, villages 26, aliases 79, and zero grants to the public
-- role.
-- =====================================================================

-- =====================================================================
-- 007_lock_down_anon.sql
-- Close the public hole. First, so everything created below is born private.
-- =====================================================================

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

-- 4. The report function is for signed-in staff only. Guarded, because this
--    file is also run on databases where the reporting migrations have not
--    happened yet, and a missing function must not stop the lockdown.
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'report_group'
  ) then
    execute 'revoke all on function public.report_group(text, text[], jsonb, jsonb, jsonb, integer) from anon, public';
    execute 'grant execute on function public.report_group(text, text[], jsonb, jsonb, jsonb, integer) to authenticated';
  end if;
end $$;

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

-- =====================================================================
-- 008_row_level_security.sql
-- Decide what each signed-in role may read and change.
-- =====================================================================

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

-- =====================================================================
-- 001_import_staging.sql
-- Staging table the bulk import writes into.
-- =====================================================================

-- Import staging: conflicts held back for review instead of being dropped.
--
-- A bulk import inserts every row that doesn't already exist. Rows whose
-- (eac_no, reg_no) is already in the target table used to be silently skipped,
-- so a corrected Access export could never update anything. They now land here
-- instead, with a snapshot of both sides, and an admin resolves each one.
--
-- Run this once in the Supabase SQL editor.

create table if not exists public.import_staging (
  id           uuid primary key default gen_random_uuid(),

  -- One batch per "Run import" click, so a review session can be scoped to it.
  batch_id     uuid not null,

  -- Which import spec produced the row, and the table it targets.
  entity       text not null,
  table_name   text not null,

  -- Identity of the record. Held as text because eac_no is bigint on
  -- Child_Data but varchar on childfmly/childsibling/childuniform/childleaving.
  eac_no       text not null,
  reg_no       text not null,

  -- The row as parsed from the file (an admin may edit this before applying),
  -- and the target row as it looked when the conflict was detected.
  incoming     jsonb not null,
  existing     jsonb not null,

  -- Columns whose values differ. Empty means the rows matched and nothing
  -- needs deciding, so identical rows are never staged in the first place.
  diff_fields  text[] not null default '{}',

  -- pending -> applied | discarded. Rows never leave the table, so the
  -- decision history stays auditable alongside activity_logs.
  state        text not null default 'pending'
                 check (state in ('pending', 'applied', 'discarded')),

  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id) on delete set null,

  -- One staged conflict per record per batch.
  unique (batch_id, entity, eac_no, reg_no)
);

create index if not exists import_staging_pending_idx
  on public.import_staging (state, created_at desc);

create index if not exists import_staging_batch_idx
  on public.import_staging (batch_id);

-- Staged rows are a copy of live child data, so they need the same protection.
alter table public.import_staging enable row level security;

drop policy if exists import_staging_admin_all on public.import_staging;

-- Admin-only, matching the import endpoints themselves. The API routes use the
-- service-role key and bypass this; the policy is what protects the table from
-- anyone reaching it directly with an anon key.
create policy import_staging_admin_all
  on public.import_staging
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- =====================================================================
-- 002_place_hierarchy.sql
-- District, taluk, panchayat, village, and the keys that stop an orphan.
-- =====================================================================

-- ============================================================================
-- Place hierarchy: district > taluk > panchayat > village
--
-- Before this, district/taluk/panchayat/village were loose text on every row,
-- so nothing stopped a typo becoming a new taluk. After this, a village cannot
-- exist without a taluk, and a taluk cannot exist without a district -- the
-- database refuses to store an orphan, it is not merely discouraged by the UI.
--
-- Safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------- districts --
create table if not exists public.districts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  state       text,
  created_at  timestamptz not null default now(),
  constraint districts_name_key unique (name)
);

-- ------------------------------------------------------------------ taluks --
create table if not exists public.taluks (
  id          uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete restrict,
  name        text not null,
  created_at  timestamptz not null default now(),
  constraint taluks_district_name_key unique (district_id, name)
);

-- A taluk can only be deleted once nothing hangs off it (on delete restrict),
-- so "orphaned district" and "taluk with no parent" are both unrepresentable.
create index if not exists taluks_district_idx on public.taluks (district_id);

-- ------------------------------------------------------------- panchayats --
create table if not exists public.panchayats (
  id         uuid primary key default gen_random_uuid(),
  taluk_id   uuid not null references public.taluks (id) on delete restrict,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint panchayats_taluk_name_key unique (taluk_id, name)
);

create index if not exists panchayats_taluk_idx on public.panchayats (taluk_id);

-- Lets villages reference the (panchayat, taluk) pair rather than the panchayat
-- alone -- see villages_panchayat_same_taluk below.
-- Added only when absent. Dropping it on a re-run fails once villages exist,
-- because the composite key below depends on this one.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'panchayats_id_taluk_key') then
    alter table public.panchayats add constraint panchayats_id_taluk_key unique (id, taluk_id);
  end if;
end $$;

-- ---------------------------------------------------------------- villages --
create table if not exists public.villages (
  id           uuid primary key default gen_random_uuid(),
  taluk_id     uuid not null references public.taluks (id) on delete restrict,
  panchayat_id uuid,
  name         text not null,
  created_at   timestamptz not null default now(),
  constraint villages_taluk_name_key unique (taluk_id, name)
);

create index if not exists villages_taluk_idx on public.villages (taluk_id);
create index if not exists villages_panchayat_idx on public.villages (panchayat_id);

-- The important one. A composite foreign key on (panchayat_id, taluk_id) means
-- a village's panchayat must sit in that village's OWN taluk. A plain FK to
-- panchayats(id) would happily let a Devanahalli village point at a
-- Doddaballapur panchayat; this cannot.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'villages_panchayat_same_taluk') then
    alter table public.villages add constraint villages_panchayat_same_taluk
  foreign key (panchayat_id, taluk_id)
  references public.panchayats (id, taluk_id)
  on delete restrict;
  end if;
end $$;

-- ----------------------------------------------------------- place_aliases --
-- Every spelling ever seen for a place, so an import resolves "DODDABALLAPPUR",
-- "Doddaballappur" and "Doddaballapura" to the one real taluk without asking a
-- human twice. `raw` is the normalised lookup key: upper case, punctuation and
-- runs of whitespace collapsed to single spaces.
create table if not exists public.place_aliases (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('district', 'taluk', 'panchayat', 'village')),
  raw          text not null,
  district_id  uuid references public.districts (id)  on delete cascade,
  taluk_id     uuid references public.taluks (id)     on delete cascade,
  panchayat_id uuid references public.panchayats (id) on delete cascade,
  village_id   uuid references public.villages (id)   on delete cascade,
  created_at   timestamptz not null default now(),
  constraint place_aliases_kind_raw_key unique (kind, raw),
  -- exactly one target, and it must match `kind`
  constraint place_aliases_one_target check (
    (case when district_id  is not null then 1 else 0 end) +
    (case when taluk_id     is not null then 1 else 0 end) +
    (case when panchayat_id is not null then 1 else 0 end) +
    (case when village_id   is not null then 1 else 0 end) = 1
  ),
  constraint place_aliases_kind_matches_target check (
    (kind = 'district'  and district_id  is not null) or
    (kind = 'taluk'     and taluk_id     is not null) or
    (kind = 'panchayat' and panchayat_id is not null) or
    (kind = 'village'   and village_id   is not null)
  )
);

create index if not exists place_aliases_lookup_idx on public.place_aliases (kind, raw);

-- ------------------------------------------- point the data at the master --
-- Added as nullable so nothing existing breaks. The text columns stay and are
-- kept in step, because exports, the volunteer form and the staff views all
-- still read them.
alter table public.centre_data  add column if not exists village_id uuid references public.villages (id) on delete restrict;
alter table public."Child_Data" add column if not exists village_id uuid references public.villages (id) on delete restrict;

create index if not exists centre_data_village_idx on public.centre_data (village_id);
create index if not exists child_data_village_idx  on public."Child_Data" (village_id);

-- ------------------------------------------------------------------- RLS --
alter table public.districts     enable row level security;
alter table public.taluks        enable row level security;
alter table public.panchayats    enable row level security;
alter table public.villages      enable row level security;
alter table public.place_aliases enable row level security;

-- Everyone signed in needs to READ places -- the volunteer form, the staff
-- views and the admin screens all populate their dropdowns from here.
do $$
declare t text;
begin
  foreach t in array array['districts', 'taluks', 'panchayats', 'villages', 'place_aliases'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select_authenticated', t
    );

    -- Only admins reshape the map. This is what stops a volunteer inventing a
    -- taluk by typing one.
    execute format('drop policy if exists %I on public.%I', t || '_write_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin'')) '
      || 'with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))',
      t || '_write_admin', t
    );
  end loop;
end $$;

-- =====================================================================
-- 003_place_seed.sql
-- Fill them from the Access file.
-- =====================================================================

-- Seed the place hierarchy from ChildInfo.accdb (1,247 child rows, 26 centres).
-- Generated. Every name below is a spelling that appears in the source; where a
-- place had several spellings the official one was kept and the rest became aliases.
-- Safe to re-run: every insert is ON CONFLICT DO NOTHING.

-- 2 districts, 3 taluks, 18 panchayats, 26 villages, 79 aliases

begin;

-- ------------------------------------------------------------ districts --
insert into public.districts (name, state) values ('Bangalore Rural', 'Karnataka') on conflict (name) do nothing;
insert into public.districts (name, state) values ('Chikkaballapur', 'Karnataka') on conflict (name) do nothing;

-- --------------------------------------------------------------- taluks --
insert into public.taluks (district_id, name) select id, 'Devanahalli' from public.districts where name = 'Bangalore Rural' on conflict (district_id, name) do nothing;
insert into public.taluks (district_id, name) select id, 'Doddaballapur' from public.districts where name = 'Bangalore Rural' on conflict (district_id, name) do nothing;
insert into public.taluks (district_id, name) select id, 'Chikkaballapur' from public.districts where name = 'Chikkaballapur' on conflict (district_id, name) do nothing;

-- ----------------------------------------------------------- panchayats --
insert into public.panchayats (taluk_id, name) select tk.id, 'Alooru Duddanahalli' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Kundana' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Gundumgere' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Hadonahalli' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Hadripura' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Hanabe' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Hosahalli' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Kadanuru' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Kantanakunte' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Kesthuru' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Kodigehalli' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Makali' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Melekote' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Rajaghatta' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'S S Ghati' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Thubugere' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Tippuru' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
insert into public.panchayats (taluk_id, name) select tk.id, 'Poshettihalli' from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' on conflict (taluk_id, name) do nothing;

-- ------------------------------------------------------------- villages --
-- EAC 101
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Bannimangala' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Alooru Duddanahalli' where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (taluk_id, name) do nothing;
-- EAC 102
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Aluru' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Alooru Duddanahalli' where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (taluk_id, name) do nothing;
-- EAC 104
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Sulukunte' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kundana' where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (taluk_id, name) do nothing;
-- EAC 105
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Koluru' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kodigehalli' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 106
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Shravanur' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kesthuru' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 108
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Menasi' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kesthuru' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 109
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Neralaghatta' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Hanabe' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 110
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Talaguvara' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kodigehalli' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 111
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Kodigehalli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kodigehalli' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 112
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Sunnaghatta' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Alooru Duddanahalli' where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (taluk_id, name) do nothing;
-- EAC 113
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Thirumagondanahalli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Hadonahalli' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 114
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Voddarahalli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kantanakunte' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 116
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Antharahalli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kantanakunte' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 117
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'K N Halli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'S S Ghati' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 118
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Hosahalli Tanda' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Tippuru' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 119
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Kanchiganalla' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Rajaghatta' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 120
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Suthahalli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Tippuru' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 121
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Hire Muddenahalli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Thubugere' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 122
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'S S Ghatti' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'S S Ghati' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 123
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Beedikere' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Melekote' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 124
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Gungiralahalli' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Poshettihalli' where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 125
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Hadripura' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Hadripura' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 126
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Kadanur' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Kadanuru' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 128
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Gundumgere 1' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Gundumgere' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 130
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Makali' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Makali' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;
-- EAC 131
insert into public.villages (taluk_id, panchayat_id, name) select tk.id, pa.id, 'Gundamgere 2' from public.taluks tk join public.districts di on di.id = tk.district_id left join public.panchayats pa on pa.taluk_id = tk.id and pa.name = 'Hosahalli' where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (taluk_id, name) do nothing;

-- -------------------------------------------------------------- aliases --
insert into public.place_aliases (kind, raw, district_id) select 'district', 'BANGALORE RURAL', id from public.districts where name = 'Bangalore Rural' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, district_id) select 'district', 'CHIKKABALLAPUR', id from public.districts where name = 'Chikkaballapur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'ALOORU DUDDANAHALLI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and pa.name = 'Alooru Duddanahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'ALURUDUDDANAHALLI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and pa.name = 'Alooru Duddanahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'GHATTI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'S S Ghati' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'GUNDUMGERE', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Gundumgere' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'HADONAHALLI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Hadonahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'HADRIPURA', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Hadripura' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'HANABE', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Hanabe' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'HOSAHALLI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Hosahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'KADANURU', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Kadanuru' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'KANTANAKUNTE', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Kantanakunte' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'KESTHURU', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Kesthuru' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'KODIGEHALLI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Kodigehalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'KUNDANA', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and pa.name = 'Kundana' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'MAKALI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Makali' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'MELEKOTE', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Melekote' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'MELINA JOGANAHALLI S S GHATI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'S S Ghati' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'POSHETTAHALLI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' and pa.name = 'Poshettihalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'POSHETTIHALLI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' and pa.name = 'Poshettihalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'RAJAGHATTA', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Rajaghatta' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'S S GHATI', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'S S Ghati' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'THIPPURU', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Tippuru' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'THUBUGERE', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Thubugere' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'TIPPURU', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Tippuru' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, panchayat_id) select 'panchayat', 'TUBAGERE', pa.id from public.panchayats pa join public.taluks tk on tk.id = pa.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and pa.name = 'Thubugere' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, taluk_id) select 'taluk', 'CHIKBALLAPUR', tk.id from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, taluk_id) select 'taluk', 'CHIKKABALLAPUR', tk.id from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, taluk_id) select 'taluk', 'DEVANAHALLI', tk.id from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, taluk_id) select 'taluk', 'DEVANHALLI', tk.id from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, taluk_id) select 'taluk', 'DODDABALLAPPUR', tk.id from public.taluks tk join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'ALURU', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and vi.name = 'Aluru' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'ANTARAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Antharahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'ANTHARAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Antharahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'BANNIMANGALA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and vi.name = 'Bannimangala' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'BEEDDIKERE', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Beedikere' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'BEEDIKERE', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Beedikere' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'GUNDAMGERE 2', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Gundamgere 2' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'GUNDUMGERE 1', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Gundumgere 1' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'GUNGIRALAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' and vi.name = 'Gungiralahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'GUNGIRLAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Chikkaballapur' and tk.name = 'Chikkaballapur' and vi.name = 'Gungiralahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'HADRIPURA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Hadripura' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'HIRE MUDDENAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Hire Muddenahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'HIREMUDDENAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Hire Muddenahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'HOSAHALLI TANDA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Hosahalli Tanda' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'HOSAHALLI THANDA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Hosahalli Tanda' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'K N HALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'K N Halli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'KADANUR', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Kadanur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'KADANURU', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Kadanur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'KANCHIGANALA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Kanchiganalla' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'KANCHIGANALLA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Kanchiganalla' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'KN HALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'K N Halli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'KODIGEHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Kodigehalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'KOLURU', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Koluru' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'MAKALI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Makali' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'MENASI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Menasi' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'NERALAGHATTA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Neralaghatta' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'S S GATTI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'S S Ghatti' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'S S GHATI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'S S Ghatti' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'S S GHATTI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'S S Ghatti' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SHRAVANUR', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Shravanur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SHRAVANURU', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Shravanur' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SS GHATI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'S S Ghatti' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SULKUNTE', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and vi.name = 'Sulukunte' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SULUKENTE', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and vi.name = 'Sulukunte' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SULUKUNTE', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and vi.name = 'Sulukunte' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SUNNAGHATTA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Devanahalli' and vi.name = 'Sunnaghatta' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SUTHAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Suthahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'SUTTAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Suthahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'TALAGAVARA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Talaguvara' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'TALAGUVARA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Talaguvara' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'TALLAGAVARA', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Talaguvara' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'THIRUMAGONDANAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Thirumagondanahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'VADDARAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Voddarahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'VADDORAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Voddarahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'VODDARAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Voddarahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'VODDORAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Voddarahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'VODDORHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Voddarahalli' on conflict (kind, raw) do nothing;
insert into public.place_aliases (kind, raw, village_id) select 'village', 'VODORAHALLI', vi.id from public.villages vi join public.taluks tk on tk.id = vi.taluk_id join public.districts di on di.id = tk.district_id where di.name = 'Bangalore Rural' and tk.name = 'Doddaballapur' and vi.name = 'Voddarahalli' on conflict (kind, raw) do nothing;

commit;

-- =====================================================================
-- 005_report_views.sql
-- Three views the report builder reads.
-- =====================================================================

-- Reporting views.
--
-- One row per child, per vocational trainee, per computer-course student, with
-- everything a report might need already joined on. The report builder reads
-- only these, so a filter called "Taluk" means the same thing in every report
-- and place names come from the place master rather than from whatever was
-- typed years ago.
--
-- Nothing here stores data. A view is a saved query: it always reflects the
-- current tables, so there is nothing to refresh and nothing to keep in sync.
--
-- Safe to re-run: each view is replaced, not added to.
--
-- Note on btrim: Postgres trim() strips spaces only. Imported place names carry
-- trailing newlines, which would otherwise split 'Devanahalli' and
-- 'Devanahalli\n' into two separate groups in every report.

begin;

-- A number that might be stored as text.
--
-- childfmly.f_inc is numeric on one deployment and text on another, and the
-- text one holds whatever was typed years ago. This returns a number when the
-- value looks like one and null otherwise, so a stray "n/a" cannot break every
-- report that touches income.
create or replace function public.report_number(v anyelement)
returns numeric language sql immutable as $$
  select case
    when v is null then null
    when btrim(v::text) ~ '^-?[0-9]+(\.[0-9]+)?$' then btrim(v::text)::numeric
  end
$$;

-- --------------------------------------------------------------- children --
create or replace view public.v_child_report
with (security_invoker = on) as
select
  c.record_id,
  c.eac_no,
  c.reg_no,

  -- Identity
  nullif(btrim(concat_ws(' ', c.first_name, c.last_name), E' \t\r\n'), '')      as child_name,
  c.first_name,
  c.last_name,
  c.gender,
  c.dateofbirth                                                    as date_of_birth,
  case
    when c.dateofbirth is null then null
    else date_part('year', age(c.dateofbirth))::int
  end                                                              as age,
  c.aadhar_no,
  c.blood_group,
  c.health,
  c.caste,
  c.religion,
  c.mother_tongue,
  c.birth_place,
  c.height,
  c.weight,
  c.photo_link,

  -- School
  c.class_std_text                                                 as class_standard,
  c.school_name,
  c.school_category,
  c.medium_of_study,
  c.sats_no,
  c.pen_no,
  c.life_ambition,
  c.fav_subject,
  c.adm_date                                                       as admission_date,

  -- Place, from the master where the child or the centre has been linked,
  -- otherwise from the old text columns so nothing disappears mid-migration.
  coalesce(di.name,  cdi.name,  nullif(btrim(c.district, E' \t\r\n'), ''))      as district,
  coalesce(tk.name,  ctk.name,  nullif(btrim(c.taluk, E' \t\r\n'), ''))         as taluk,
  coalesce(pa.name,  cpa.name,  nullif(btrim(c.panchayat, E' \t\r\n'), ''))     as panchayat,
  coalesce(vi.name,  nullif(btrim(c.village, E' \t\r\n'), ''))                  as village,
  coalesce(cvi.name, nullif(btrim(c.village_name, E' \t\r\n'), ''))             as centre_village,
  (c.village_id is not null or ce.village_id is not null)          as place_from_master,

  -- Enrolment and approval, kept as two separate ideas.
  coalesce(c.child_left, false)                                    as has_left,
  case when coalesce(c.child_left, false) then 'Left' else 'Enrolled' end as enrolment,
  coalesce(c.status, 'Pending')                                    as approval_status,
  c.created_at                                                     as recorded_on,
  c.approved_at,

  -- Which linked sections exist. The report builder turns these into
  -- "missing family details" style filters without another join.
  (fm.record_id is not null)                                       as has_family,
  (sb.record_id is not null)                                       as has_siblings,
  (un.record_id is not null)                                       as has_uniform,
  (lv.record_id is not null)                                       as has_leaving_record,
  -- Leaving counts only once a child is marked as left, so an enrolled child
  -- is never reported as missing a record they should not have.
  (
    fm.record_id is not null
    and sb.record_id is not null
    and un.record_id is not null
    and (not coalesce(c.child_left, false) or lv.record_id is not null)
  )                                                                as sections_complete,

  -- Family
  fm.f_name                                                        as father_name,
  fm.f_occup                                                       as father_occupation,
  public.report_number(fm.f_inc)                                   as father_income,
  fm.f_mobile                                                      as father_mobile,
  fm.m_name                                                        as mother_name,
  fm.m_occup                                                       as mother_occupation,
  public.report_number(fm.m_inc)                                   as mother_income,
  fm.m_mobile                                                      as mother_mobile,
  -- null, not 0, when nothing was recorded: a zero would drag every average down.
  case
    when public.report_number(fm.f_inc) is null and public.report_number(fm.m_inc) is null then null
    else coalesce(public.report_number(fm.f_inc), 0) + coalesce(public.report_number(fm.m_inc), 0)
  end                                                              as household_income,
  nullif(btrim(concat_ws(', ', fm.fmly_addr1, fm.fmly_addr2, fm.fmly_addr3), E' \t\r\n'), '') as family_address,
  fm.fmly_pincode                                                  as family_pincode,

  -- Siblings: the five name columns are counted rather than listed, which is
  -- what every report actually asks for.
  -- null when the section was never filled in, so "no siblings recorded" and
  -- "recorded as having none" stay distinguishable.
  case when sb.record_id is null then null else (
    (case when nullif(btrim(sb.names_1, E' \t\r\n'), '') is not null then 1 else 0 end) +
    (case when nullif(btrim(sb.names_2, E' \t\r\n'), '') is not null then 1 else 0 end) +
    (case when nullif(btrim(sb.names_3, E' \t\r\n'), '') is not null then 1 else 0 end) +
    (case when nullif(btrim(sb.names_4, E' \t\r\n'), '') is not null then 1 else 0 end) +
    (case when nullif(btrim(sb.names_5, E' \t\r\n'), '') is not null then 1 else 0 end)
  ) end                                                            as sibling_count,

  -- Uniform, the sizes a procurement list is built from
  un.shirtsize                                                     as shirt_size,
  un.knickersize                                                   as knicker_size,
  un.pant_skirtsize                                                as pant_skirt_size,
  un.chudidharsize                                                 as chudidhar_size,
  un.top_pantsize                                                  as top_pant_size,
  un.footwearsize                                                  as footwear_size,
  un.uniform_updated                                               as uniform_measured_on,

  -- Leaving
  lv.leav_date                                                     as leaving_date,
  lv.reason                                                        as leaving_reason,
  lv.leav_class                                                    as class_when_leaving,
  lv.pass_status                                                   as pass_status,

  -- Centre
  ce.start_date                                                    as centre_started,
  ce.end_date                                                      as centre_ended,
  (ce.end_date is not null and ce.end_date <= current_date)         as centre_closed,
  ce.cbv_name,
  ce.in_charge
from public."Child_Data" c
left join public.centre_data ce on ce.eac_no::text = c.eac_no::text

-- These key columns are not the same type on every deployment: reg_no is text
-- on one Supabase project and a number on another, and eac_no varies the same
-- way. Casting both sides to text makes the join work on either without
-- having to know which shape a given database happens to have.
left join public.childfmly    fm on fm.eac_no::text = c.eac_no::text and fm.reg_no::text = c.reg_no::text
left join public.childsibling sb on sb.eac_no::text = c.eac_no::text and sb.reg_no::text = c.reg_no::text
left join public.childuniform un on un.eac_no::text = c.eac_no::text and un.reg_no::text = c.reg_no::text
left join public.childleaving lv on lv.eac_no::text = c.eac_no::text and lv.reg_no::text = c.reg_no::text

left join public.villages   vi  on vi.id  = c.village_id
left join public.taluks     tk  on tk.id  = vi.taluk_id
left join public.districts  di  on di.id  = tk.district_id
left join public.panchayats pa  on pa.id  = vi.panchayat_id

left join public.villages   cvi on cvi.id = ce.village_id
left join public.taluks     ctk on ctk.id = cvi.taluk_id
left join public.districts  cdi on cdi.id = ctk.district_id
left join public.panchayats cpa on cpa.id = cvi.panchayat_id;

comment on view public.v_child_report is
  'One row per child with family, siblings, uniform, leaving, centre and place joined on. Read by the report builder.';

-- ----------------------------------------------------- vocational course --
create or replace view public.v_vocational_report
with (security_invoker = on) as
select
  v.id,
  v.eac_no,
  v.reg_no,
  v.trainee_name,
  v.gender,
  v.date_of_birth,
  case when v.date_of_birth is null then null else date_part('year', age(v.date_of_birth))::int end as age,
  v.religion,
  v.caste,
  v.mother_tongue,
  v.class_standard_studied                                         as class_standard,
  v.school_name,
  v.medium_of_study,
  v.enrolled_course                                                as course,
  v.batch_no,
  v.date_of_admission                                              as admission_date,
  v.present_status,
  v.plan_after_course,
  v.education_training_employment                                  as outcome,
  v.reason_for_leaving,
  v.leaving_date,
  v.father_or_husband_name                                         as father_name,
  v.father_occupation,
  v.father_income,
  v.mother_name,
  v.mother_occupation,
  v.mother_income,
  case
    when public.report_number(v.father_income) is null and public.report_number(v.mother_income) is null then null
    else coalesce(public.report_number(v.father_income), 0) + coalesce(public.report_number(v.mother_income), 0)
  end                                                              as household_income,
  coalesce(di.name, nullif(btrim(v.district, E' \t\r\n'), ''))                  as district,
  coalesce(tk.name, nullif(btrim(v.taluk, E' \t\r\n'), ''))                     as taluk,
  coalesce(pa.name, nullif(btrim(v.panchayat, E' \t\r\n'), ''))                 as panchayat,
  coalesce(vi.name, nullif(btrim(v.village, E' \t\r\n'), ''))                   as village,
  coalesce(v.status, 'Pending')                                    as approval_status,
  v.created_at                                                     as recorded_on
from public.vocational_course v
left join public.centre_data ce on ce.eac_no::text = v.eac_no::text
left join public.villages   vi on vi.id = ce.village_id
left join public.taluks     tk on tk.id = vi.taluk_id
left join public.districts  di on di.id = tk.district_id
left join public.panchayats pa on pa.id = vi.panchayat_id;

-- ------------------------------------------------------- computer course --
create or replace view public.v_computer_report
with (security_invoker = on) as
select
  k.id,
  k.eac_no,
  k.reg_no,
  k.child_name,
  k.gender,
  k.date_of_birth,
  case when k.date_of_birth is null then null else date_part('year', age(k.date_of_birth))::int end as age,
  k.class_standard,
  k.school_name,
  k.school_type,
  k.course_name                                                    as course,
  k.batch_no,
  k.date_of_admission                                              as admission_date,
  k.completion_date,
  k.attendance_percentage,
  k.final_assessment_score,
  k.overall_performance,
  k.certificate_issued_on,
  k.instructor_name,
  k.prior_computer_knowledge,
  k.father_occupation,
  k.father_income,
  k.mother_occupation,
  k.mother_income,
  case
    when public.report_number(k.father_income) is null and public.report_number(k.mother_income) is null then null
    else coalesce(public.report_number(k.father_income), 0) + coalesce(public.report_number(k.mother_income), 0)
  end                                                              as household_income,
  di.name                                                          as district,
  tk.name                                                          as taluk,
  pa.name                                                          as panchayat,
  vi.name                                                          as village,
  coalesce(k.status, 'Pending')                                    as approval_status,
  k.created_at                                                     as recorded_on
from public.computer_course k
left join public.centre_data ce on ce.eac_no::text = k.eac_no::text
left join public.villages   vi on vi.id = ce.village_id
left join public.taluks     tk on tk.id = vi.taluk_id
left join public.districts  di on di.id = tk.district_id
left join public.panchayats pa on pa.id = vi.panchayat_id;

-- The views inherit row-level security from the tables underneath
-- (security_invoker), so this grant does not widen what anyone can see.
revoke all on function public.report_number(anyelement) from anon, public;
grant execute on function public.report_number(anyelement) to authenticated;

grant select on public.v_child_report      to authenticated;
grant select on public.v_vocational_report to authenticated;
grant select on public.v_computer_report   to authenticated;

commit;

-- =====================================================================
-- 006_report_functions.sql
-- The grouping function the report builder calls.
-- =====================================================================

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

-- =====================================================================
-- Final sweep and verification
--
-- The lockdown ran before these objects existed, so this repeats it for
-- anything created since.
-- =====================================================================

begin;
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
commit;

select
  (select count(*) from public.districts)                        as districts,
  (select count(*) from public.taluks)                           as taluks,
  (select count(*) from public.panchayats)                       as panchayats,
  (select count(*) from public.villages)                         as villages,
  (select count(*) from public.place_aliases)                    as aliases,
  (select count(*) from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public')         as grants_to_public;

-- Which tables are protected now. Any record table showing false here was
-- not covered.
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by rowsecurity, tablename;
