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
