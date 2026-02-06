# Pneuma Canonical Product Plan

**Canonical reference file:** `docs/PNEUMA_CANONICAL_PLAN.md`  
**Status:** Active planning baseline  
**Last updated:** February 6, 2026

Use this file as the single source of truth for product scope, architecture, feature breakdown, and testing.

---

## 1. Source PRD (Verbatim)

# **Product Requirements Document (PRD): Pneuma (Agentic Edition)**

**Version:** 2.0 (MCP Architecture)  
**Date:** February 6, 2026  
**Core Philosophy:** "Don't render the HTML. Let Gamma generate the artifact."

## **1. The "Agentic" Architecture**

Instead of your app trying to *draw* the sermon summary, it acts as a manager that hires two "AI Employees" (MCP Servers) to do the work.

* **The Brain:** OpenAI `gpt-5-mini` (The Orchestrator).
* **The Designer:** Gamma MCP Server (Generates the visual webpage).
* **The Librarian:** Supabase MCP Server (Stores the links/data).

### **User Flow**

1. **Input:** User taps "Listen". Audio is recorded and sent to OpenAI (`whisper-1`).
2. **Orchestration:** The transcript is fed to `gpt-5-mini` with a specific toolset enabled.
3. **Action 1 (Design):** `gpt-5-mini` calls the `gamma_generate_webpage` tool.
* *Instruction:* "Create a 'Sermon Summary' webpage using the 'Sanctuary' theme. Use the transcript to fill the content."


4. **Action 2 (Memory):** `gpt-5-mini` calls the `supabase_insert_row` tool.
* *Instruction:* "Save the Sermon Title, Date, and the **Gamma URL** to the user's database."


5. **Output:** The user is redirected to the stunning, interactive **Gamma Webpage** (hosted by Gamma, branded as Pneuma).

---

## **2. Technical Stack**

* **Frontend:** Next.js 14 (App Router) – *Extremely thin client.*
* **Auth:** Google OAuth (via Supabase Auth).
* **AI Model:** OpenAI `gpt-5-mini` (Orchestrator) + `whisper-1` (Audio).
* **MCP Servers:**
* **Gamma MCP:** For generating the UI artifact.
* **Supabase MCP:** For database operations.


* **SDK:** `langchain` or Vercel `ai` SDK (to manage the tool calling).

---

## **3. Functional Specifications**

### **3.1 The MCP Tool Definitions**

These are the "skills" you give your AI.

**Tool A: `create_gamma_site**`

* **Source:** Gamma MCP
* **Function:** `generate_webpage(topic, content_outline, theme_id)`
* **Prompt Strategy:**
> "You are a theological editor. Take the transcript, extract the 'Hero Verse' and 3 key points. Then, call `generate_webpage`.
> Pass the content in a structured format.
> Use Theme ID: `[Your_Custom_Pneuma_Theme_ID]` (Create this once in Gamma manually)."



**Tool B: `archive_sermon**`

* **Source:** Supabase MCP
* **Function:** `database_execute_sql` or `insert_row`
* **Schema:**
```sql
TABLE sermons (
  id UUID PRIMARY KEY,
  user_id UUID,
  title TEXT,
  gamma_url TEXT, -- The link returned by Tool A
  created_at TIMESTAMP
);

```



### **3.2 The Backend Logic (Next.js Server Action)**

This is the only code you really need to write.

```typescript
// app/actions/processSermon.ts
'use server'

import { OpenAI } from "openai";
import { SupabaseClient } from "@supabase/supabase-js";

// 1. Initialize OpenAI with Tool Definitions
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function processSermonAudio(audioFile: File, userId: string) {
  
  // Step A: Transcribe (Whisper-1)
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
  });

  // Step B: The Agentic Handoff (GPT-5 Mini)
  // We describe the tools, we don't implement the API calls manually if using an MCP-compliant agent framework,
  // but here is the raw "Function Calling" logic for clarity.
  
  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: "You are Pneuma. Analyze the sermon. 1. Generate a Gamma Webpage summary. 2. Save the result to Supabase." },
      { role: "user", content: transcription.text }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "generate_gamma_site",
          description: "Generates a visual webpage summary on Gamma.app",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              cards: { 
                type: "array", 
                items: { type: "object", properties: { content: { type: "string" } } } 
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "save_to_db",
          description: "Saves the sermon metadata and Gamma link to Supabase",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              gamma_url: { type: "string" }
            }
          }
        }
      }
    ]
  });

  // Step C: Handle the Tool Calls (The "Glue")
  // You would capture the tool_calls arguments here and execute the actual API requests 
  // to Gamma and Supabase using their respective SDKs/MCP clients.
  
  return { status: "success" };
}

```

---

## **4. UI/UX (The "Gamma" Integration)**

Since Gamma is generating the view, your App UI is incredibly simple.

* **Dashboard:** A list of cards.
* **Card Content:**
* Title: "The Way of Peace"
* Date: "Feb 6, 2026"
* **Action:** When clicked, it opens the **Gamma URL** in a `WebView` (Mobile) or New Tab (Desktop).


* **Why this is better:**
* Gamma's rendering engine is superior to anything you can code in Tailwind manually.
* The user gets a link they can text to friends immediately ("Check out these notes").
* Gamma supports "Embed Mode," so you can embed the resulting page directly inside your Pneuma app iframes.



---

## **5. Setup Requirements**

1. **OpenAI:**
* Enable `gpt-5-mini` access.


2. **Gamma:**
* Create a "Pneuma Template" in Gamma (Manual Step).
* Style it perfectly (Fonts, colors, Verse Box).
* Get the `template_id` to pass to the API.


3. **Supabase:**
* Enable the **Supabase MCP Server** (via the Supabase dashboard -> Integrations).
* Get the connection string.



## **6. Cost Analysis (Per Sermon)**

| Service | Model | Cost (Est.) |
| --- | --- | --- |
| **Transcription** | Whisper-1 | $0.006 / min (~$0.24/hr) |
| **Reasoning** | GPT-5 Mini | ~$0.02 (Input + Tool Output) |
| **Visuals** | Gamma API | ~$0.05 (Per generation credit) |
| **Total** |  | **~$0.31 per sermon** |

*Pricing Note:* You can charge a subscription ($5/mo) and easily cover these margins.

---

## 2. Discovery And Learned Constraints (Current Repo + Implementation Reality)

### Repo discovery (February 6, 2026)
- Current workspace had no existing app files; this is a greenfield build.
- `rg` is not installed in the local shell environment, so file search fallback is needed (`find`/`ls`) unless installed later.

### Product and engineering learnings
- The app should remain thin: core product value is orchestration and artifact management, not custom rendering.
- Reliability depends on "tool glue" quality: argument validation, retries, idempotency, and error recovery are first-class requirements.
- Gamma template quality directly impacts end-user delight; template design is effectively part of product quality.
- Since URLs are durable outputs, archival correctness (title/date/url/user linkage) is critical for trust.
- Cost and latency must be visible per job; otherwise production spend can drift unnoticed.

### Architecture decisions locked (February 6, 2026)
- Gamma integration is direct API, not Gamma MCP.
- Gamma API authentication is API key based (`X-API-KEY`); OAuth is not yet available.
- Gamma integration must use v1.0 endpoints. v0.2 was deprecated on January 16, 2026.
- Primary generation path is Create from Template (beta) via `POST /v1.0/generations/from-template`.
- Gamma theme/folder discovery can use the dedicated list APIs.
- Operational debugging should log the Gamma `x-request-id` response header.

### Gamma API contract snapshot (to implement now)
- Endpoint: `POST /v1.0/generations/from-template`.
- Auth: `X-API-KEY: <gamma_api_key>`.
- Required request fields: `gammaId` (template/deck ID).
- Common content fields: `inputText`, `language` (default `en-US`), optional `themeId`, optional `folderId`.
- Optional formatting controls: `textSettings` and `imageSource`.
- Discovery endpoints for setup workflows:
  - `GET /v1.0/themes`
  - `GET /v1.0/folders`

### Reference docs (Gamma)
- Getting Started: https://developers.gamma.app/docs/getting-started
- Generate API parameters: https://developers.gamma.app/docs/generate-api-parameters-explained
- Themes/Folders APIs: https://developers.gamma.app/docs/list-themes-and-list-folders-apis-explained
- API support and request tracing: https://developers.gamma.app/docs/best-practices-and-support

### Clarifications to lock early
- Choose between:
  - strict template remix flow (`POST /v1.0/generations/from-template`) and
  - generic generate flow (v1.0 Generate endpoint), if fallback is needed.
- Whether to implement true MCP transport now or use equivalent function-calling wrappers first.
- Data retention policy for transcripts/audio and PII handling expectations.
- Max sermon duration and file size limits for upload/recording UX.

---

## 3. Feature Breakdown (Implementation Plan)

## Feature 1: Authentication And User Session (Supabase + Google OAuth)
**Goal:** Securely identify users and isolate sermon archives per user.

**Build scope**
- Configure Supabase Auth with Google provider.
- Add sign-in/sign-out flow in Next.js App Router.
- Persist user session and protect dashboard routes.

**Acceptance criteria**
- Unauthenticated users are redirected to sign-in.
- Authenticated users can open dashboard and process sermons.
- `user_id` stored for every sermon record.

**Tests**
- Unit: auth guard utility returns redirect for missing session.
- Integration: callback creates valid session cookie.
- E2E: sign-in, open dashboard, sign-out, route protection.

---

## Feature 2: Audio Capture And Upload
**Goal:** Capture sermon audio and submit it to backend processing.

**Build scope**
- "Listen" action in thin client.
- Browser recording flow with clear start/stop/status states.
- Upload constraints (type, duration, file size).

**Acceptance criteria**
- User can record and submit audio successfully.
- Validation errors shown for unsupported/oversized uploads.
- Upload progress and failure states are visible.

**Tests**
- Unit: validate MIME type/size/duration checks.
- Integration: upload endpoint receives and streams file.
- E2E: record mock audio, submit, observe processing state.

---

## Feature 3: Transcription Pipeline (`whisper-1`)
**Goal:** Convert sermon audio to high-quality transcript.

**Build scope**
- Server-side transcription call with `whisper-1`.
- Structured response object for downstream orchestration.
- Error handling for API timeout/rate-limit/provider failure.

**Acceptance criteria**
- Valid transcript text returned for normal audio.
- Failed transcription does not create sermon archive row.
- User receives actionable retry feedback.

**Tests**
- Unit: transcription adapter maps provider response to internal DTO.
- Integration: mock OpenAI transcription success/failure paths.
- Contract: schema validation for transcript payload.

---

## Feature 4: Orchestrator Agent (`gpt-5-mini` Tool Calling)
**Goal:** Derive structured sermon summary and trigger external tools.

**Build scope**
- System prompt that enforces Hero Verse + 3 key points extraction.
- Tool definitions for Gamma generation and Supabase archival.
- Guardrails for malformed tool call arguments.

**Acceptance criteria**
- Output tool call contains stable `title` and summary sections.
- Tool call errors are caught and surfaced with fallback messaging.
- Orchestrator does not proceed with empty transcript.

**Tests**
- Unit: schema parsing and validation of tool arguments.
- Integration: simulated model tool-call flow with deterministic fixtures.
- Regression: prompt snapshot tests for structured output shape.

---

## Feature 5: Gamma API Artifact Generation (`create_gamma_site`)
**Goal:** Produce branded sermon summary webpage via Gamma.

**Build scope**
- Implement Gamma API client wrapper with `X-API-KEY` auth.
- Call `POST /v1.0/generations/from-template` with mapped sermon content.
- Pass template/theme and structured content outline (`gammaId`, `inputText`, optional `themeId`/`folderId`).
- Capture Gamma response URL and generation metadata.
- Capture and persist `x-request-id` for support/debugging.

**Acceptance criteria**
- Successful generation returns reachable `gamma_url`.
- Failures retry with bounded attempts and emit error state.
- Generated page respects Pneuma theme/template.
- v1.0 contract validation prevents malformed payload submission.

**Tests**
- Unit: Gamma client request mapping and response parsing.
- Integration: API mock for success/4xx/5xx/timeouts and header capture (`x-request-id`).
- Contract: schema test for `POST /v1.0/generations/from-template` request body.
- E2E: completed run opens Gamma page from dashboard card.

---

## Feature 6: Sermon Archive Persistence (`archive_sermon`)
**Goal:** Persist title/date/url with user ownership in Supabase.

**Build scope**
- Create `sermons` table + indexes + RLS.
- Write row only after Gamma generation succeeds.
- Include created timestamp and foreign key semantics.

**Acceptance criteria**
- Each successful run creates exactly one row.
- Rows are visible only to owning user.
- Duplicate writes prevented for same job idempotency key.

**Tests**
- Unit: DB insert payload builder.
- Integration: SQL migration + insert/select with RLS policies.
- Security: unauthorized user cannot read other users' sermons.

---

## Feature 7: Dashboard And Sermon Cards
**Goal:** Provide clean archive browser and open Gamma artifacts quickly.

**Build scope**
- Card list with title/date/status.
- Loading, empty, and error states.
- Card click opens Gamma URL (new tab/webview behavior by platform).

**Acceptance criteria**
- Dashboard displays newest sermons first.
- Clicking card opens correct URL.
- Empty state guides user to record first sermon.

**Tests**
- Unit: sort/format utility.
- Integration: server component fetch + render states.
- E2E: create sermon then verify card appears and opens URL.

---

## Feature 8: Observability, Cost, And Reliability
**Goal:** Keep pipeline measurable, debuggable, and cost-aware.

**Build scope**
- Structured logs per stage (upload, transcribe, orchestrate, gamma, archive).
- Job correlation IDs and latency metrics.
- Cost estimation fields per run.

**Acceptance criteria**
- Every run has traceable lifecycle logs.
- Failures include stage + reason.
- Cost estimate visible in admin/debug views.

**Tests**
- Unit: cost estimator arithmetic.
- Integration: log envelope includes correlation id.
- Resilience: injected failures produce deterministic status transitions.

---

## 4. End-To-End Test Matrix

| Flow | Expected Result |
| --- | --- |
| Sign in -> record audio -> process -> dashboard card | Sermon appears with valid `gamma_url` |
| Transcription API failure | Job marked failed; no DB row written |
| Gamma API failure after transcript success | Job failed with retry path; no partial archive row |
| DB insert failure after Gamma success | User sees error; retry safely writes one row only |
| Unauthorized dashboard access | Redirect to sign-in |
| Cross-user data access attempt | Blocked by RLS |

---

## 5. Non-Functional Requirements

- Security: Supabase RLS enabled from first migration.
- Privacy: define retention policy for transcript/audio before launch.
- Performance: typical end-to-end turnaround target under 45-90 seconds for average sermon upload chunks.
- Reliability: idempotent backend job handling for retries.
- Maintainability: strict schema validation between each pipeline stage.

---

## 6. Suggested Delivery Phases

1. Foundation: Next.js app, auth, Supabase table, RLS.
2. Pipeline core: upload + whisper transcription + orchestrator tool schema.
3. External actions: Gamma generation + Supabase archive write.
4. UX polish: dashboard states, error recovery, retry UX.
5. Hardening: observability, cost tracking, security/perf testing.

---

## 7. Open Decisions Log

- Decide SDK approach: Vercel `ai` SDK vs `langchain` for tool orchestration.
- Confirm final Gamma v1.0 response fields to map as canonical `gamma_url`.
- Decide where to store transcripts (DB vs object storage vs no storage).
- Define idempotency key design (`user_id + audio_hash + created_window` or job UUID).

---

## 8. Implementation Checklist

- [ ] Initialize Next.js 14 app router project.
- [ ] Configure Supabase auth + Google OAuth.
- [ ] Add DB migration for `sermons` table and RLS.
- [ ] Implement `processSermonAudio` server action.
- [ ] Integrate `whisper-1` transcription.
- [ ] Integrate `gpt-5-mini` orchestrator + tools.
- [ ] Integrate Gamma generation client.
- [ ] Persist Gamma URL in Supabase.
- [ ] Build dashboard list and card open behavior.
- [ ] Add tests (unit/integration/e2e) from matrix.
- [ ] Add logs, cost tracking, and failure telemetry.
