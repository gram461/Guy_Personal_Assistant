-- Adds a users table that every per-user table hangs off (deleting a user deletes all their rows),
-- plus storage for scraped Schoology data. Run after 20261008_per_user_data.sql, on the test project first.

begin;

create table users (
  user_id text not null,
  created_at timestamptz not null default now(),
  constraint users_pk primary key (user_id)
);

insert into users (user_id)
select user_id from settings
union select user_id from google_tokens
union select user_id from push_tokens
union select user_id from completed_assignments
union select user_id from morning_summaries;

alter table settings add constraint settings_user_fk foreign key (user_id) references users (user_id) on delete cascade;
alter table google_tokens add constraint google_tokens_user_fk foreign key (user_id) references users (user_id) on delete cascade;
alter table push_tokens add constraint push_tokens_user_fk foreign key (user_id) references users (user_id) on delete cascade;
alter table completed_assignments add constraint completed_assignments_user_fk foreign key (user_id) references users (user_id) on delete cascade;
alter table morning_summaries add constraint morning_summaries_user_fk foreign key (user_id) references users (user_id) on delete cascade;

-- Never holds a password: only the encrypted session Schoology issues after login.
create table schoology_connections (
  user_id text not null,
  session_encrypted text not null,
  schoology_user_id text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok', 'session_expired', 'failed')),
  constraint schoology_connections_user_pk primary key (user_id),
  constraint schoology_connections_user_fk foreign key (user_id) references users (user_id) on delete cascade
);

-- Deleting a grading period cascades to its courses, categories and assignments; that is how retention works.
create table grading_periods (
  user_id text not null,
  period_id text not null,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  constraint grading_periods_pk primary key (user_id, period_id),
  constraint grading_periods_user_fk foreign key (user_id) references users (user_id) on delete cascade,
  constraint grading_periods_dates_check check (ends_on >= starts_on)
);
create index grading_periods_ends_on_idx on grading_periods (ends_on);

create table courses (
  user_id text not null,
  period_id text not null,
  section_id text not null,
  name text not null,
  grade_percent numeric(6, 2),
  grade_letter text,
  constraint courses_pk primary key (user_id, period_id, section_id),
  constraint courses_period_fk foreign key (user_id, period_id)
    references grading_periods (user_id, period_id) on delete cascade
);

create table grade_categories (
  user_id text not null,
  period_id text not null,
  section_id text not null,
  category_id text not null,
  name text not null,
  weight numeric(6, 2) check (weight between 0 and 100),
  constraint grade_categories_pk primary key (user_id, period_id, section_id, category_id),
  constraint grade_categories_course_fk foreign key (user_id, period_id, section_id)
    references courses (user_id, period_id, section_id) on delete cascade
);

create table assignments (
  user_id text not null,
  period_id text not null,
  section_id text not null,
  assignment_id text not null,
  category_id text,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  due_all_day boolean not null default false,
  score numeric(8, 2),
  max_points numeric(8, 2),
  status text not null check (status in ('ungraded', 'graded', 'missing', 'excused')),
  is_late boolean not null default false,
  constraint assignments_pk primary key (user_id, period_id, assignment_id),
  constraint assignments_course_fk foreign key (user_id, period_id, section_id)
    references courses (user_id, period_id, section_id) on delete cascade
);
create index assignments_user_due_idx on assignments (user_id, due_at);

-- Replaces everything stored for the grading periods in the snapshot, all-or-nothing:
-- if any row is bad the whole call fails and the previous copy stays.
create function save_schoology_snapshot(p_user_id text, p_snapshot jsonb)
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

  insert into courses (user_id, period_id, section_id, name, grade_percent, grade_letter)
  select p_user_id, r.period_id, r.section_id, r.name, r.grade_percent, r.grade_letter
  from jsonb_to_recordset(p_snapshot->'courses')
    as r(period_id text, section_id text, name text, grade_percent numeric, grade_letter text);

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

revoke all on function save_schoology_snapshot(text, jsonb) from public, anon, authenticated;
grant execute on function save_schoology_snapshot(text, jsonb) to service_role;

-- Only the server (service role, which bypasses RLS) may touch these tables. The public anon key gets nothing.
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'schoology_connections', 'grading_periods', 'courses', 'grade_categories', 'assignments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;
