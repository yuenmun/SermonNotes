# Sermon Notes Webapp (Next.js 14)

Sermon Notes is a thin orchestration app:
- `whisper-1` transcribes sermon audio.
- `gpt-5-mini` extracts structured sermon content.
- Gamma API generates the sermon webpage artifact.
- Supabase stores sermon metadata and Gamma links per user.

Canonical planning reference: `docs/PNEUMA_CANONICAL_PLAN.md`

## Stack

- Next.js 14 (App Router)
- Supabase Auth (Google OAuth) + Postgres
- OpenAI (`whisper-1`, `gpt-5-mini`)
- Gamma API v1.0 (`POST /v1.0/generations/from-template`)

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create env file:
```bash
cp .env.example .env.local
```

3. Fill `.env.local` values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `GAMMA_API_KEY`
- `GAMMA_TEMPLATE_ID` (optional but recommended for branded template output)

4. Run DB migration in Supabase SQL editor (or CLI):
- `supabase/migrations/20260206220000_create_sermons.sql`

5. Configure Google OAuth in Supabase Auth:
- Enable Google provider.
- Add redirect URL: `http://localhost:3000/auth/callback`

6. Start app:
```bash
npm run dev
```

Open `http://localhost:3000`.

## Implemented Flow

1. Sign in on `/login`:
- Google OAuth (if provider is enabled in Supabase), or
- Email magic link fallback.
2. Open dashboard (`/dashboard`) and generate from:
- browser recording
- audio upload
- pasted transcript text
3. Backend route `/api/sermons/process`:
- validates audio
- hashes file for idempotency
- calls OpenAI transcription
- calls GPT tool extraction
- calls Gamma generation API
- inserts sermon row in Supabase
4. Dashboard sermon library:
- search by title/pastor/tag
- filter by tag
- grid/list toggle
- open Gamma button + share link copy
- edit title/pastor/tags + delete sermon

## Important Files

- `src/app/dashboard/page.tsx`
- `src/app/api/sermons/process/route.ts`
- `src/lib/sermon/process.ts`
- `src/lib/sermon/orchestrator.ts`
- `src/lib/gamma/client.ts`
- `supabase/migrations/20260206220000_create_sermons.sql`

## Notes

- Gamma response URL extraction is defensive to handle payload variants.
- API route uses Node runtime for OpenAI file handling.
- Middleware keeps Supabase session cookies refreshed.
