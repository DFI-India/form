-- SUPERSEDED — DO NOT RUN.
--
-- 2026-09-28: every row this repairs is test data at EAC 234, which is being
-- wiped before the real import. Kept only as a record of what went wrong and
-- how it was diagnosed. If the same orphaning ever happens to real data, the
-- matching rule below is the one to reuse.
--
-- Re-link section rows that were saved without a Reg No.
--
-- What this does, in plain words: some family, sibling and uniform rows were
-- saved with an empty reg_no, so they belong to no child and the admin screen
-- shows those sections as "Not recorded". The volunteer form saves the child
-- first and its sections a second or two later, so each orphan is matched to
-- the child at the same centre, by the same volunteer, created closest before
-- it (within 10 seconds). Every match below is listed with the gap in seconds.
--
-- Safe to re-run: each update only touches a row whose reg_no is still empty.
-- Generated 2026-09-17 from a read-only scan. Review, then run in the Supabase SQL Editor.

begin;

-- childfmly
update public.childfmly set reg_no = '1' where record_id = 22 and reg_no is null and eac_no = '234';  -- Aishwarya KV, EAC 234 Reg 1, +1s
update public.childfmly set reg_no = '3' where record_id = 23 and reg_no is null and eac_no = '234';  -- Kailash, EAC 234 Reg 3, +1s
update public.childfmly set reg_no = '4' where record_id = 24 and reg_no is null and eac_no = '234';  -- Ramesh, EAC 234 Reg 4, +1s
update public.childfmly set reg_no = '6' where record_id = 25 and reg_no is null and eac_no = '234';  -- Vyshnav, EAC 234 Reg 6, +1s
update public.childfmly set reg_no = '7' where record_id = 26 and reg_no is null and eac_no = '234';  -- Rajesh, EAC 234 Reg 7, +0s
update public.childfmly set reg_no = '8' where record_id = 27 and reg_no is null and eac_no = '234';  -- Alok, EAC 234 Reg 8, +1s
update public.childfmly set reg_no = '11' where record_id = 28 and reg_no is null and eac_no = '234';  -- Ishika, EAC 234 Reg 11, +1s
update public.childfmly set reg_no = '12' where record_id = 29 and reg_no is null and eac_no = '234';  -- Preetham, EAC 234 Reg 12, +1s
update public.childfmly set reg_no = '13' where record_id = 30 and reg_no is null and eac_no = '234';  -- Sahaya, EAC 234 Reg 13, +0s
update public.childfmly set reg_no = '14' where record_id = 31 and reg_no is null and eac_no = '234';  -- Aashik, EAC 234 Reg 14, +1s
update public.childfmly set reg_no = '15' where record_id = 32 and reg_no is null and eac_no = '234';  -- Pratiksha P, EAC 234 Reg 15, +1s
update public.childfmly set reg_no = '16' where record_id = 33 and reg_no is null and eac_no = '234';  -- Jyotika S, EAC 234 Reg 16, +1s
update public.childfmly set reg_no = '17' where record_id = 34 and reg_no is null and eac_no = '234';  -- Riya Bajaj, EAC 234 Reg 17, +2s

-- childsibling
update public.childsibling set reg_no = '1' where record_id = 15 and reg_no is null and eac_no = '234';  -- Aishwarya KV, EAC 234 Reg 1, +1s
update public.childsibling set reg_no = '3' where record_id = 16 and reg_no is null and eac_no = '234';  -- Kailash, EAC 234 Reg 3, +1s
update public.childsibling set reg_no = '4' where record_id = 17 and reg_no is null and eac_no = '234';  -- Ramesh, EAC 234 Reg 4, +1s
update public.childsibling set reg_no = '6' where record_id = 18 and reg_no is null and eac_no = '234';  -- Vyshnav, EAC 234 Reg 6, +1s
update public.childsibling set reg_no = '7' where record_id = 19 and reg_no is null and eac_no = '234';  -- Rajesh, EAC 234 Reg 7, +1s
update public.childsibling set reg_no = '8' where record_id = 20 and reg_no is null and eac_no = '234';  -- Alok, EAC 234 Reg 8, +1s
update public.childsibling set reg_no = '11' where record_id = 21 and reg_no is null and eac_no = '234';  -- Ishika, EAC 234 Reg 11, +1s
update public.childsibling set reg_no = '12' where record_id = 22 and reg_no is null and eac_no = '234';  -- Preetham, EAC 234 Reg 12, +1s
update public.childsibling set reg_no = '13' where record_id = 23 and reg_no is null and eac_no = '234';  -- Sahaya, EAC 234 Reg 13, +1s
update public.childsibling set reg_no = '14' where record_id = 24 and reg_no is null and eac_no = '234';  -- Aashik, EAC 234 Reg 14, +2s
update public.childsibling set reg_no = '15' where record_id = 25 and reg_no is null and eac_no = '234';  -- Pratiksha P, EAC 234 Reg 15, +1s
update public.childsibling set reg_no = '16' where record_id = 26 and reg_no is null and eac_no = '234';  -- Jyotika S, EAC 234 Reg 16, +1s
update public.childsibling set reg_no = '17' where record_id = 27 and reg_no is null and eac_no = '234';  -- Riya Bajaj, EAC 234 Reg 17, +3s

-- childuniform
update public.childuniform set reg_no = '1' where record_id = 16 and reg_no is null and eac_no = '234';  -- Aishwarya KV, EAC 234 Reg 1, +1s
update public.childuniform set reg_no = '3' where record_id = 17 and reg_no is null and eac_no = '234';  -- Kailash, EAC 234 Reg 3, +1s
update public.childuniform set reg_no = '4' where record_id = 18 and reg_no is null and eac_no = '234';  -- Ramesh, EAC 234 Reg 4, +1s
update public.childuniform set reg_no = '6' where record_id = 19 and reg_no is null and eac_no = '234';  -- Vyshnav, EAC 234 Reg 6, +2s
update public.childuniform set reg_no = '7' where record_id = 20 and reg_no is null and eac_no = '234';  -- Rajesh, EAC 234 Reg 7, +1s
update public.childuniform set reg_no = '8' where record_id = 21 and reg_no is null and eac_no = '234';  -- Alok, EAC 234 Reg 8, +1s
update public.childuniform set reg_no = '11' where record_id = 22 and reg_no is null and eac_no = '234';  -- Ishika, EAC 234 Reg 11, +1s
update public.childuniform set reg_no = '12' where record_id = 23 and reg_no is null and eac_no = '234';  -- Preetham, EAC 234 Reg 12, +1s
update public.childuniform set reg_no = '13' where record_id = 24 and reg_no is null and eac_no = '234';  -- Sahaya, EAC 234 Reg 13, +1s
update public.childuniform set reg_no = '14' where record_id = 25 and reg_no is null and eac_no = '234';  -- Aashik, EAC 234 Reg 14, +2s
update public.childuniform set reg_no = '15' where record_id = 26 and reg_no is null and eac_no = '234';  -- Pratiksha P, EAC 234 Reg 15, +1s
update public.childuniform set reg_no = '16' where record_id = 27 and reg_no is null and eac_no = '234';  -- Jyotika S, EAC 234 Reg 16, +1s
update public.childuniform set reg_no = '17' where record_id = 28 and reg_no is null and eac_no = '234';  -- Riya Bajaj, EAC 234 Reg 17, +3s

-- Guard: if any child would now have two rows in one section, stop and undo
-- everything above. (Leaving is excluded; it has unrelated test duplicates.)
do $$
begin
  if exists (select 1 from public.childfmly    where reg_no is not null group by eac_no, reg_no having count(*) > 1)
  or exists (select 1 from public.childsibling where reg_no is not null group by eac_no, reg_no having count(*) > 1)
  or exists (select 1 from public.childuniform where reg_no is not null group by eac_no, reg_no having count(*) > 1)
  then
    raise exception 'A child would end up with two rows in one section. Nothing was changed.';
  end if;
end $$;

commit;
