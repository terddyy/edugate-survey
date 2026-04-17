# EduGate Survey

Simple survey app scaffold built with Next.js 16 + TypeScript, with Supabase
client wiring kept for upcoming survey persistence.

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

3. Set your Supabase values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Supabase Client

The reusable browser client is located at `lib/supabase/client.ts`.
