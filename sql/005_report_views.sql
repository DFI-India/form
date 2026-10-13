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
  (fm.record_id is not null and sb.record_id is not null and un.record_id is not null) as sections_complete,

  -- Family
  fm.f_name                                                        as father_name,
  fm.f_occup                                                       as father_occupation,
  fm.f_inc                                                         as father_income,
  fm.f_mobile                                                      as father_mobile,
  fm.m_name                                                        as mother_name,
  fm.m_occup                                                       as mother_occupation,
  fm.m_inc                                                         as mother_income,
  fm.m_mobile                                                      as mother_mobile,
  -- null, not 0, when nothing was recorded: a zero would drag every average down.
  case
    when fm.f_inc is null and fm.m_inc is null then null
    else coalesce(fm.f_inc, 0) + coalesce(fm.m_inc, 0)
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
left join public.centre_data ce on ce.eac_no = c.eac_no

-- eac_no is bigint on Child_Data and varchar on every linked table.
left join public.childfmly    fm on fm.eac_no = c.eac_no::text and fm.reg_no = c.reg_no::text
left join public.childsibling sb on sb.eac_no = c.eac_no::text and sb.reg_no = c.reg_no::text
left join public.childuniform un on un.eac_no = c.eac_no::text and un.reg_no = c.reg_no::text
left join public.childleaving lv on lv.eac_no = c.eac_no::text and lv.reg_no = c.reg_no::text

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
    when v.father_income is null and v.mother_income is null then null
    else coalesce(v.father_income, 0) + coalesce(v.mother_income, 0)
  end                                                              as household_income,
  coalesce(di.name, nullif(btrim(v.district, E' \t\r\n'), ''))                  as district,
  coalesce(tk.name, nullif(btrim(v.taluk, E' \t\r\n'), ''))                     as taluk,
  coalesce(pa.name, nullif(btrim(v.panchayat, E' \t\r\n'), ''))                 as panchayat,
  coalesce(vi.name, nullif(btrim(v.village, E' \t\r\n'), ''))                   as village,
  coalesce(v.status, 'Pending')                                    as approval_status,
  v.created_at                                                     as recorded_on
from public.vocational_course v
left join public.centre_data ce on ce.eac_no = v.eac_no
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
    when k.father_income is null and k.mother_income is null then null
    else coalesce(k.father_income, 0) + coalesce(k.mother_income, 0)
  end                                                              as household_income,
  di.name                                                          as district,
  tk.name                                                          as taluk,
  pa.name                                                          as panchayat,
  vi.name                                                          as village,
  coalesce(k.status, 'Pending')                                    as approval_status,
  k.created_at                                                     as recorded_on
from public.computer_course k
-- computer_course.eac_no is text; centre_data.eac_no is bigint.
left join public.centre_data ce on ce.eac_no::text = k.eac_no
left join public.villages   vi on vi.id = ce.village_id
left join public.taluks     tk on tk.id = vi.taluk_id
left join public.districts  di on di.id = tk.district_id
left join public.panchayats pa on pa.id = vi.panchayat_id;

-- The views inherit row-level security from the tables underneath
-- (security_invoker), so this grant does not widen what anyone can see.
grant select on public.v_child_report      to authenticated;
grant select on public.v_vocational_report to authenticated;
grant select on public.v_computer_report   to authenticated;

commit;
