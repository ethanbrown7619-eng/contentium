# plan.md — Clipium build plan for Claude Code

Companion to Clipium-PRD.md. Execute phases in order; each task lists the **Claude model** the agent should run with (`/model` in Claude Code, or `--model` per invocation), acceptance criteria, and dependencies. Suggested repo: `clipium/`.

**Model legend**
- **opus** = `claude-opus-4-8` — architecture, tricky concurrency, prompt design (substitute `claude-fable-5` if available in your Claude Code plan)
- **sonnet** = `claude-sonnet-4-6` — default implementation model
- **haiku** = `claude-haiku-4-5-20251001` — boilerplate, config, docs, simple tests

Rule of thumb: plan with opus, build with sonnet, sweep with haiku. Re-verify model IDs at https://docs.claude.com/en/api/overview before starting.

---

## Phase 0 — Repo & environment (½ day)

| # | Task | Model | Acceptance |
|---|---|---|---|
| 0.1 | Init monorepo: `apps/api` (Hono Worker), `apps/web` (Vite SPA), `containers/processor` (Dockerfile), `packages/shared` (types, zod schemas). pnpm workspaces + TypeScript strict. | haiku | `pnpm build` green in all packages |
| 0.2 | `wrangler.jsonc` for the Worker: bindings for R2 (`MEDIA`), D1 (`DB`), Queues (producers/consumers), Workers AI (`AI`), Containers, secrets placeholders (`ANTHROPIC_API_KEY`, `YT_API_KEY`, `WEBSUB_SECRET`). | haiku | `wrangler deploy --dry-run` passes |
| 0.3 | CI: GitHub Actions — typecheck, lint, unit tests, `wrangler deploy --dry-run`, container image build. | haiku | CI green on main |
| 0.4 | D1 schema migration 0001: `videos`, `jobs`, `job_stages`, `clips`, `settings`, `costs`. Include state enum from PRD FR-5 and indexes on `videos.yt_id`, `jobs.state`. | sonnet | Migration applies; schema matches PRD state machine |

## Phase 1 — Architecture lock-in (1 day)

| # | Task | Model | Acceptance |
|---|---|---|---|
| 1.1 | Write `docs/ARCHITECTURE.md`: sequence diagrams for detect→ready flow, queue message contracts (zod schemas in `packages/shared`), R2 key layout, retry/idempotency strategy (video ID as idempotency key; R2 artifacts as stage checkpoints). | **opus** | Every queue message and D1 transition documented; schemas compile |
| 1.2 | Decide Container sizing/limits (disk for 2h 1080p sources, concurrency, max job duration) and document scale/cost model against the $0.50/source-hour ceiling. | **opus** | Cost worksheet in `docs/COSTS.md` |
| 1.3 | Threat model: WebSub callback verification (HMAC + hub challenge), signed R2 URLs, Access policy, secret handling. | **opus** | `docs/SECURITY.md` checklist |

## Phase 2 — Detection & ingestion (2 days)

| # | Task | Model | Acceptance |
|---|---|---|---|
| 2.1 | WebSub subscriber: `/websub/callback` GET (hub.challenge echo) + POST (Atom parse, HMAC verify, dedupe against D1, enqueue `download`). Lease renewal via Cron. | sonnet | Simulated hub POST creates exactly one job; replay is deduped |
| 2.2 | Fallback poller (Cron 15 min): uploads playlist via YouTube Data API, enqueue unseen videos; skip < min duration and live videos (FR-1). | sonnet | Poller catches a video the callback "missed" in test |
| 2.3 | Container `processor`: Dockerfile with yt-dlp + ffmpeg + (fallback) faster-whisper; HTTP control endpoint invoked from the Worker via the Containers binding. `download` handler: fetch ≤1080p, write `sources/{videoId}/source.mp4` + `audio.m4a` to R2, update D1, enqueue `transcribe`. | sonnet | End-to-end: enqueue video ID → files land in R2, job advances |
| 2.4 | Rights acknowledgment gate: settings flag must be true before any download job runs (PRD 1.4). | haiku | Download refused with clear error until acknowledged |

## Phase 3 — Transcription (1–2 days)

| # | Task | Model | Acceptance |
|---|---|---|---|
| 3.1 | Audio chunker (silence-aligned ~10 min chunks with 5s overlap) + Workers AI Whisper calls with word timestamps; stitch chunks, resolve overlap duplicates; write `transcripts/{videoId}.json`. | sonnet | 2h test audio produces monotonic word timestamps, drift <0.5s at seams |
| 3.2 | Container fallback path with faster-whisper when Workers AI errors or omits word timing. | sonnet | Kill-switch env var forces fallback; output schema identical |
| 3.3 | Transcript schema + fixtures in `packages/shared`; golden-file tests. | haiku | Fixtures cover multi-speaker + long-silence cases |

## Phase 4 — Moment selection with Claude (2 days) — the quality core

| # | Task | Model | Acceptance |
|---|---|---|---|
| 4.1 | Design the FR-3 selection prompt: system prompt encoding hook-first/self-contained/sentence-boundary criteria, few-shot examples, strict JSON output contract, transcript compaction strategy for very long inputs (segment summaries → candidate windows → word-level refinement second call). | **opus** | Prompt doc + rationale in `docs/PROMPTS.md` |
| 4.2 | Implement `selectMoments()` calling the Anthropic API (runtime model `claude-sonnet-4-6`, configurable via `settings`), zod-validate, snap boundaries to word timestamps, enforce length prefs, cap clip count. | sonnet | On 3 fixture transcripts returns 3–8 valid, non-overlapping moments |
| 4.3 | Copy pass: `claude-haiku-4-5-20251001` generates title/hook/post/hashtags per moment; JSON repair retry (1 attempt) on validation failure. | sonnet | 100 synthetic runs: 0 unhandled parse failures |
| 4.4 | Eval harness: `pnpm eval` runs selection against 5 hand-labeled transcripts and reports overlap/quality metrics; store labeled set in `evals/`. | **opus** | Baseline metrics recorded; harness reused for prompt iterations |
| 4.5 | Cost logging per Claude call (tokens in/out → `costs` table). | haiku | Dashboard-queryable cost per job |

## Phase 5 — Rendering (2–3 days)

| # | Task | Model | Acceptance |
|---|---|---|---|
| 5.1 | ASS caption generator: word-timed karaoke-style active-word highlight, style params (font/colors/position) from settings; also emit `.srt`. | sonnet | Rendered sample matches style preview pixel-close |
| 5.2 | Container `render` handler: ffmpeg trim → crop/scale 1080×1920 (focus region param) → burn ASS → loudness normalize → faststart MP4 to `clips/{videoId}/{clipId}.mp4`. | sonnet | 60s clip renders <90s in Container; A/V sync verified |
| 5.3 | Fan-out/fan-in: one queue message per clip; `finalize` marks `ready` when all clips done, `partial_failure` if some fail after retries. | sonnet | Forced single-clip failure yields `partial_failure`, others `ready` |
| 5.4 | Trim-nudge re-render: API accepts ±offsets, re-enqueues just that clip, versions the artifact. | sonnet | Old version retained until new render succeeds |

## Phase 6 — Dashboard (2–3 days)

| # | Task | Model | Acceptance |
|---|---|---|---|
| 6.1 | API routes (Hono): jobs list/detail, clips list, approve/reject, nudge, settings CRUD, manual-URL trigger with channel check, signed clip URLs, `/health`. | sonnet | OpenAPI-ish route doc; integration tests pass |
| 6.2 | SPA: Queue, Review (inline `<video>`, rationale/confidence, approve/reject/nudge), Library (download MP4/SRT), Settings (incl. caption live preview). Keep deps minimal (React + Tailwind). | sonnet | Owner completes story #3 flow end-to-end locally |
| 6.3 | Cloudflare Access wiring + local-dev bypass flag; verify no route reachable unauthenticated. | sonnet | curl without Access JWT → 403 on every non-WebSub route |
| 6.4 | Empty states, error toasts, stage-progress indicators; polish pass. | haiku | No dead-end screens |

## Phase 7 — Hardening & launch (1–2 days)

| # | Task | Model | Acceptance |
|---|---|---|---|
| 7.1 | Watchdog Cron for stalled jobs; retry/backoff audit across all consumers; idempotency tests (duplicate WebSub, duplicate queue delivery). | sonnet | Chaos test: kill container mid-render → job recovers |
| 7.2 | E2E test against a real unlisted test channel upload. | sonnet | Upload → clips `ready` ≤30 min; metrics logged |
| 7.3 | `README.md` + `docs/RUNBOOK.md` (deploy, secrets, WebSub re-subscribe, common failures). | haiku | A fresh operator can deploy from docs alone |
| 7.4 | Final review pass: security checklist from 1.3, cost report vs ceiling, PRD success-metric instrumentation in place. | **opus** | Sign-off doc `docs/LAUNCH_REVIEW.md` |

---

## Dependency graph (critical path)

0.x → 1.1 → 2.3 → 3.1 → 4.2 → 5.2 → 5.3 → 6.2 → 7.2

Phases 4.1/4.4 (prompt + evals) and 6.x can proceed in parallel with 5.x once fixtures exist.

## Standing instructions for the Claude Code agent

1. All cross-boundary payloads (queue messages, API bodies, Claude outputs) validate through zod schemas in `packages/shared` — never trust raw JSON.
2. Every stage is idempotent: check for the R2 artifact before recomputing.
3. Runtime Claude model IDs live in `settings`/env, never hardcoded in business logic.
4. Never log transcript content or API keys; log IDs and token counts only.
5. When uncertain about Cloudflare Containers/Queues/Workers AI specifics, consult current Cloudflare docs rather than assuming — these products change quickly.
