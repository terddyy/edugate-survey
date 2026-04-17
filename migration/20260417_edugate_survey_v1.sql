-- EduGate Survey V1 schema + policies
-- This migration is idempotent and safe to re-run.

begin;

create extension if not exists pgcrypto;

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  respondent_name text null,
  consent_agreed boolean not null default true,
  answers jsonb not null,
  metadata jsonb not null,
  constraint survey_responses_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint survey_responses_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint survey_responses_consent_required check (consent_agreed = true)
);

create index if not exists survey_responses_created_at_idx
  on public.survey_responses (created_at desc);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  constraint admin_users_email_format check (position('@' in email) > 1)
);

insert into public.admin_users (email)
values ('terddy03@gmail.com')
on conflict (email) do nothing;

alter table public.survey_responses enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to anon, authenticated;

grant insert on table public.survey_responses to anon, authenticated;
grant select on table public.survey_responses to authenticated;

drop policy if exists "anon_insert_survey_responses" on public.survey_responses;
create policy "anon_insert_survey_responses"
on public.survey_responses
for insert
to anon
with check (consent_agreed = true);

drop policy if exists "authenticated_insert_survey_responses" on public.survey_responses;
create policy "authenticated_insert_survey_responses"
on public.survey_responses
for insert
to authenticated
with check (consent_agreed = true);

drop policy if exists "admin_select_survey_responses" on public.survey_responses;
create policy "admin_select_survey_responses"
on public.survey_responses
for select
to authenticated
using (public.is_admin_user());

commit;

