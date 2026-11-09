-- Stores the teacher on each class. Run after 20261009_scraper_storage.sql, on the test project first.
-- Safe to run before or after deploying: the save function ignores fields it doesn't know about.

begin;

alter table courses add column teacher_name text;

create or replace function save_schoology_snapshot(p_user_id text, p_snapshot jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from grading_periods
  where user_id = p_user_id
    and period_id in (select x->>'period_id' from jsonb_array_elements(p_snapshot->'grading_periods') x);

  insert into grading_periods (user_id, period_id, name, starts_on, ends_on)
  select p_user_id, r.period_id, r.name, r.starts_on, r.ends_on
  from jsonb_to_recordset(p_snapshot->'grading_periods')
    as r(period_id text, name text, starts_on date, ends_on date);

  insert into courses (user_id, period_id, section_id, name, teacher_name, grade_percent, grade_letter)
  select p_user_id, r.period_id, r.section_id, r.name, r.teacher_name, r.grade_percent, r.grade_letter
  from jsonb_to_recordset(p_snapshot->'courses')
    as r(period_id text, section_id text, name text, teacher_name text, grade_percent numeric, grade_letter text);

  insert into grade_categories (user_id, period_id, section_id, category_id, name, weight)
  select p_user_id, r.period_id, r.section_id, r.category_id, r.name, r.weight
  from jsonb_to_recordset(p_snapshot->'categories')
    as r(period_id text, section_id text, category_id text, name text, weight numeric);

  insert into assignments (
    user_id, period_id, section_id, assignment_id, category_id, title, description,
    due_at, due_all_day, score, max_points, status, is_late
  )
  select p_user_id, r.period_id, r.section_id, r.assignment_id, r.category_id, r.title, r.description,
    r.due_at, r.due_all_day, r.score, r.max_points, r.status, r.is_late
  from jsonb_to_recordset(p_snapshot->'assignments')
    as r(
      period_id text, section_id text, assignment_id text, category_id text, title text, description text,
      due_at timestamptz, due_all_day boolean, score numeric, max_points numeric, status text, is_late boolean
    );
end;
$$;

commit;
