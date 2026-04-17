-- EduGate Survey V2 participant type support
-- Adds participant_type with safe backfill for historical rows.

begin;

alter table public.survey_responses
  add column if not exists participant_type text;

update public.survey_responses
set participant_type = 'pilot_tester'
where participant_type is null;

alter table public.survey_responses
  alter column participant_type set default 'pilot_tester';

alter table public.survey_responses
  alter column participant_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'survey_responses_participant_type_check'
      and conrelid = 'public.survey_responses'::regclass
  ) then
    alter table public.survey_responses
      add constraint survey_responses_participant_type_check
      check (participant_type in ('pilot_tester', 'non_tester'));
  end if;
end $$;

create index if not exists survey_responses_participant_type_idx
  on public.survey_responses (participant_type);

commit;
