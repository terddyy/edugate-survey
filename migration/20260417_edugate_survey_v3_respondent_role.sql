-- EduGate Survey V3 respondent role support
-- Adds respondent_role with nullable legacy compatibility.

begin;

alter table public.survey_responses
  add column if not exists respondent_role text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'survey_responses_respondent_role_check'
      and conrelid = 'public.survey_responses'::regclass
  ) then
    alter table public.survey_responses
      add constraint survey_responses_respondent_role_check
      check (
        respondent_role is null
        or respondent_role in ('student', 'faculty', 'staff')
      );
  end if;
end $$;

create index if not exists survey_responses_respondent_role_idx
  on public.survey_responses (respondent_role);

commit;
