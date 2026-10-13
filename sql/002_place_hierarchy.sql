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
alter table public.panchayats drop constraint if exists panchayats_id_taluk_key;
alter table public.panchayats add constraint panchayats_id_taluk_key unique (id, taluk_id);

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
alter table public.villages drop constraint if exists villages_panchayat_same_taluk;
alter table public.villages add constraint villages_panchayat_same_taluk
  foreign key (panchayat_id, taluk_id)
  references public.panchayats (id, taluk_id)
  on delete restrict;

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
