# Database setup, in order

Run these in the Supabase SQL editor, one file at a time, top to bottom. Every
file is safe to run twice.

| # | File | What it does | Needed for |
|---|------|--------------|-----------|
| 001 | `001_import_staging.sql` | Staging table the bulk import writes into | Import |
| 002 | `002_place_hierarchy.sql` | District, taluk, panchayat, village tables and the keys that stop an orphan | Centre data, Child data, Reports |
| 003 | `003_place_seed.sql` | Fills them from the Access file: 2 districts, 3 taluks, 18 panchayats, 26 villages, 79 spellings | Same |
| 005 | `005_report_views.sql` | Three views that join everything a report needs onto one row | Reports |
| 006 | `006_report_functions.sql` | The grouping function the report builder calls | Reports |
| 007 | `007_lock_down_anon.sql` | Removes all access from the public key | Security |
| 008 | `008_row_level_security.sql` | Decides what each signed-in role may read and change | Security |

`004_relink_orphan_sections.sql` is marked SUPERSEDED. Do not run it. It
repairs rows that only exist in the old test data.

## After running them

Check the place list arrived:

```sql
select
  (select count(*) from districts)  as districts,   -- expect 2
  (select count(*) from taluks)     as taluks,      -- expect 3
  (select count(*) from panchayats) as panchayats,  -- expect 18
  (select count(*) from villages)   as villages,    -- expect 26
  (select count(*) from place_aliases) as aliases;  -- expect 79
```

Check nothing is left open to the public key:

```sql
select count(*) as still_granted_to_anon
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public';   -- expect 0
```

Check row-level security is on everywhere it should be:

```sql
select tablename, rowsecurity
  from pg_tables where schemaname = 'public'
 order by rowsecurity, tablename;
```

Then sign in as a field volunteer and submit one child. That single action
exercises the insert policies on six tables at once. Sign in as an admin and
approve it to exercise the staff path.

## What 007 and 008 each do

They are two different locks and you want both.

**007** takes every privilege away from `anon`, the role the public key uses.
That key ships inside the website's JavaScript, so anyone who opens the site
has it. On the development project it could read every child record, every
parent's details and every user account without signing in.

**008** governs what a *signed-in* person can reach, which grants alone cannot
express. Verified against a copy of this schema:

| Action | Volunteer | DFI staff | Admin |
|---|---|---|---|
| Read records | yes | yes | yes |
| Edit own pending or rejected work | yes | yes | yes |
| Edit own approved record | no | yes | yes |
| Edit another person's record | no | yes | yes |
| Submit as somebody else | refused | — | — |
| Approve a submission | no | yes | yes |
| Delete a record | no | no | yes |
| Change a role | no | no | yes |
| Read other people's profiles | no | yes | yes |

Signed out, with table grants deliberately left in place, all three of read,
write and update were still refused. The policies hold on their own.

## Still to decide

A volunteer can currently read every child, not only those at their own centre.
Narrowing that is the right next step, but it needs testing against each
volunteer screen with a real account, so it is deliberately not in 008.
