-- Moves every table from one shared 'default' row to per-user rows keyed by the Google account id (NextAuth token.sub).
-- Run once in the Supabase SQL editor. Old tables are renamed to *_legacy; drop them once the new version works.
-- Constraints are named explicitly because renaming a table does not rename its old "<table>_pkey" index.

begin;

-- Holds a plaintext Google refresh token; it is replaced by an encrypted copy on next sign-in.
drop table if exists google_tokens;

alter table if exists settings rename to settings_legacy;
alter table if exists push_tokens rename to push_tokens_legacy;
alter table if exists completed_assignments rename to completed_assignments_legacy;
alter table if exists morning_summaries rename to morning_summaries_legacy;

create table settings (
  user_id text not null,
  notifications jsonb not null default '{"morning": true, "afternoon": true, "night": true}',
  nightly_checklist jsonb not null default '{"studied": true, "workedOut": true, "packed": true}',
  display_name text check (char_length(display_name) <= 50),
  updated_at timestamptz not null default now(),
  constraint settings_user_pk primary key (user_id)
);

create table google_tokens (
  user_id text not null,
  refresh_token_encrypted text not null,
  updated_at timestamptz not null default now(),
  constraint google_tokens_user_pk primary key (user_id)
);

create table push_tokens (
  token text not null,
  user_id text not null,
  last_seen_at timestamptz not null default now(),
  constraint push_tokens_token_pk primary key (token)
);
create index push_tokens_user_id_idx on push_tokens (user_id);

create table completed_assignments (
  user_id text not null,
  uid text not null,
  completed_at timestamptz not null default now(),
  constraint completed_assignments_user_uid_pk primary key (user_id, uid)
);

create table morning_summaries (
  user_id text not null,
  summary text not null,
  generated_date date not null,
  updated_at timestamptz not null default now(),
  constraint morning_summaries_user_pk primary key (user_id)
);

-- Only the server (service role, which bypasses RLS) may touch these tables. The public anon key gets nothing.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'google_tokens', 'push_tokens', 'completed_assignments', 'morning_summaries',
    'settings_legacy', 'push_tokens_legacy', 'completed_assignments_legacy', 'morning_summaries_legacy'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

commit;

-- After you've confirmed the new version works:
-- drop table settings_legacy, push_tokens_legacy, completed_assignments_legacy, morning_summaries_legacy;
