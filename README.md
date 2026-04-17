# EduGate Survey

Anonymous EduGate survey built with Next.js 16 + TypeScript + Supabase.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from the example file:

```bash
# macOS/Linux
cp .env.local.example .env.local

# Windows PowerShell
Copy-Item .env.local.example .env.local
```

3. Configure `.env.local`:

```env
NEXT_PUBLIC_SURVEY_ENABLED=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

- `NEXT_PUBLIC_SURVEY_ENABLED=true` enables the survey form at `/`.
- Any value other than `"true"` shows the survey unavailable page.
- `SUPABASE_SERVICE_ROLE_KEY` is only needed for admin account bootstrap script.

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Database Migration

Run the SQL migration in:

```text
/migration/20260417_edugate_survey_v1.sql
/migration/20260417_edugate_survey_v2_participant_type.sql
/migration/20260417_edugate_survey_v3_respondent_role.sql
```

This migration creates:
- `public.survey_responses` for survey submissions.
- `public.admin_users` allowlist table.
- RLS policies:
  - anon/authenticated can insert survey responses.
  - only allowlisted admin users can select survey responses.
- seeded allowlist entry for `terddy03@gmail.com`.
- `participant_type` support with safe backfill (`pilot_tester` default for historical rows).
- `respondent_role` support for `student | faculty | staff` with nullable legacy compatibility.

## Admin Account Bootstrap

Create the admin auth user:

```bash
npm run create:admin -- terddy03@gmail.com demo123
```

This uses Supabase Admin API (`auth.admin.createUser`) and requires:
- `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- The script now also resets the password if the user already exists and ensures
  the email is present in `public.admin_users`.

After creating the account:
- open `/admin`
- sign in with:
  - email: `terddy03@gmail.com`
  - password: `demo123`
- you can view survey submissions there.

## Data Shape

- `respondent_name`: optional text from respondent.
- `respondent_role`: required by the app for new submissions (`student`, `faculty`, or `staff`); may be `null` for legacy rows.
- `participant_type`: respondent classification (`pilot_tester` or `non_tester`).
- `consent_agreed`: always `true` for successful submissions.
- `answers`: JSON object keyed by section/question (`CCEE.q1` style keys represented as nested section objects), scoped to the participant questionnaire variant.
- `metadata`: includes survey version, respondent role, participant questionnaire variant, active section codes, Likert labels, and client timestamp.

## Supabase Client

Reusable browser client is located at `lib/supabase/client.ts`.
