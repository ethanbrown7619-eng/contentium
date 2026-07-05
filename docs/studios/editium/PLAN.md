# Editium-plan.md — Editium Implementation Plan for Claude Code

**Companion to:** Editium-PRD.md (read it first — it is the source of truth for scope)
**Executor:** Claude Code agent(s)
**Date:** 2026-07-06

---

## How to use this plan

- Work through phases in order. Each phase ends with a **verification gate** — do not proceed until it passes.
- Each task specifies a **recommended Claude model**. Switch with `/model` in Claude Code, or run the task in a subagent pinned to that model. Rationale for assignments:
  - **claude-fable-5** — architecture decisions, the auto-edit algorithm, anything where a wrong early decision is expensive.
  - **claude-opus-4-8** — alternative to Fable 5 for hard tasks if Fable 5 is unavailable on your plan.
  - **claude-sonnet-4-6** — the default workhorse: standard feature implementation, API endpoints, React UI, tests.
  - **claude-haiku-4-5** — boilerplate, config files, scaffolding, docs, simple scripts, lint fixes.
- Commit after every task. Keep tasks small enough to revert.
- Environment assumptions: Node 20+, Wrangler CLI authenticated to a Cloudflare account with Workers Paid plan (required for Queues + Containers), Docker available locally for the container image.

---

## Phase 0 — Repo & tooling scaffold

| # | Task | Model | Notes |
|---|---|---|---|
| 0.1 | Monorepo scaffold: `apps/web` (React+Vite+TS+Tailwind), `apps/api` (Hono Worker), `apps/render` (Python container), `packages/shared` (TS types + style-recipe JSON schema). pnpm workspaces. | haiku-4-5 | Pure boilerplate |
| 0.2 | Wrangler config: Worker with Assets binding, R2 buckets (`raw-clips`, `renders`, `tracks`), D1 database, Queue (`render-jobs`) producer/consumer bindings, Containers binding. Separate `dev`/`prod` environments. | sonnet-4-6 | Bindings interplay warrants Sonnet over Haiku |
| 0.3 | CI (GitHub Actions): typecheck, lint, unit tests, `wrangler deploy --dry-run`, container image build. | haiku-4-5 | |
| 0.4 | D1 schema + migrations for `jobs`, `clips`, `styles`, `tracks` per PRD §5. Seed script for styles/tracks. | haiku-4-5 | Schema is fully specified in PRD |

**Gate 0:** `pnpm dev` serves the web app locally via `wrangler dev`; migrations apply; CI green.

---

## Phase 1 — Walking skeleton (PRD M1)

| # | Task | Model | Notes |
|---|---|---|---|
| 1.1 | Presigned multipart upload flow: `POST /api/uploads` + `/complete`, R2 multipart, client uploader with resume + progress + 10 MB parts. | fable-5 | Mobile-resilient resumable upload has many failure-mode edge cases; get it right once |
| 1.2 | Job creation + queue producer: `POST /api/jobs` validates payload (zod, shared types), writes D1 rows, enqueues message. | sonnet-4-6 | |
| 1.3 | Render container v0: Dockerfile (python:3.12-slim + ffmpeg), queue consumer entrypoint, download clips from R2, `ffmpeg concat` + scale to 1080×1920 center-crop, upload MP4 to `renders`, update job status, ack/retry semantics with dead-letter handling. | fable-5 | Queue semantics + partial-failure handling is the reliability core of the whole system |
| 1.4 | Job status endpoint + minimal UI: upload screen → job page polling `GET /api/jobs/:id` → video player + download. | sonnet-4-6 | |
| 1.5 | Structured logging + error surfaces (job.error column shown in UI, container logs to stdout with job id). | haiku-4-5 | |

**Gate 1:** From a phone browser: upload 3 real clips → receive a concatenated vertical MP4 → download it. Kill the container mid-render → job retries and completes.

---

## Phase 2 — Beat-synced assembly, one style (PRD M2)

| # | Task | Model | Notes |
|---|---|---|---|
| 2.1 | Track library: pick ~20 royalty-free tracks, script to compute + hand-verify beat grids (librosa onsets → JSON), upload to R2, seed D1. | sonnet-4-6 | |
| 2.2 | Style-recipe JSON schema (packages/shared): cut policy, min/max segment length, transition set, effect stack, grade/LUT ref, slow-mo rules. Write the "Hype" recipe. | fable-5 | This schema is the extension point for all future styles — design carefully |
| 2.3 | Timeline assembler: given clips + beat grid + recipe → edit decision list (EDL): ordered segments with in/out, speed, transition, effects. Cuts land on beats; segments fill target duration. Pure function + heavy unit tests with synthetic beat grids. | fable-5 | The core algorithm |
| 2.4 | EDL → FFmpeg compiler: translate EDL to filter_complex graphs (trim, setpts speed ramps, xfade transitions, zoompan punches, eq/LUT grade), mux with the track, faststart. | fable-5 | filter_complex generation is notoriously fiddly; correctness here defines output quality |
| 2.5 | Wire style/track pickers into the UI; job payload carries styleId/trackId. | sonnet-4-6 | |
| 2.6 | Golden-output tests: fixed inputs → assert EDL snapshots + ffprobe assertions on output (duration, resolution, stream layout). | sonnet-4-6 | |

**Gate 2:** Hype-style edit from 4 clips where cuts audibly land on beats; golden tests pass in CI.

---

## Phase 3 — Moment detection & smart reframe (PRD M3)

| # | Task | Model | Notes |
|---|---|---|---|
| 3.1 | Analysis pass: per-clip motion intensity (OpenCV optical flow on downscaled mezzanine), scene-change detection, audio energy curve. Persist `analysis_json`. | fable-5 | Signal design determines whether "best moments" are actually best |
| 3.2 | Segment ranking: combine signals into scored candidate segments; assembler consumes ranked segments (best moment → slow-mo at the drop). | fable-5 | |
| 3.3 | Subject-tracking 9:16 reframe: motion-centroid track + temporal smoothing → animated crop window; center-crop fallback when confidence is low. | fable-5 | Hardest CV task in the project |
| 3.4 | "Remix" endpoint + UI: new job reusing stored analysis artifacts. | sonnet-4-6 | |
| 3.5 | Perf pass: 720p mezzanine for analysis, parallelize per-clip analysis, measure against PRD p50/p95 targets. | opus-4-8 | Profiling + optimization judgment; Opus is a good fit if you want to conserve Fable 5 usage |

**Gate 3:** Blind test on 5 real game videos: chosen moments match a human's picks ≥70% of the time; reframe keeps the action in frame; remix completes in <40% of original job time.

---

## Phase 4 — Full style pack, captions, sharing (PRD M4)

| # | Task | Model | Notes |
|---|---|---|---|
| 4.1 | Cinematic, Retro/VHS, Clean recipes + any new effect primitives they need (grain, chromatic aberration, letterbox, whip transition). | sonnet-4-6 | Engine exists; this is recipe + filter work |
| 4.2 | Animated caption/hook rendering (drawtext/ASS subtitles with pop-in animation) + UI text input. | sonnet-4-6 | |
| 4.3 | Optional AI hook suggestions: Worker endpoint calling Claude API (`claude-haiku-4-5-20251001`) with clip analysis summary → 3 hook options. Keep it optional and rate-limited. | sonnet-4-6 | Note: this is a runtime API choice, not a Claude Code model choice — Haiku keeps per-job cost negligible |
| 4.4 | Share pages: `/v/:id` with OG tags, animated WebP preview, signed R2 URLs. | sonnet-4-6 | |
| 4.5 | Output lifecycle: R2 lifecycle rules / cron Worker to expire outputs after 7 days; UI messaging. | haiku-4-5 | |

**Gate 4:** All 4 styles produce visibly distinct, postable outputs; share link unfurls correctly in a chat app.

---

## Phase 5 — Hardening & launch (PRD M5)

| # | Task | Model | Notes |
|---|---|---|---|
| 5.1 | Failure-mode sweep: corrupt uploads, unsupported codecs, 0-second clips, huge files, duplicate queue delivery, container OOM. Add guards + user-facing errors. | opus-4-8 | Adversarial thinking about edge cases |
| 5.2 | Load test: 20 concurrent jobs; tune container instance count/limits and queue batch settings. | sonnet-4-6 | |
| 5.3 | Security review: signed URL scoping, upload size/type enforcement server-side, no path traversal in R2 keys, rate limiting on job creation. | fable-5 | Security review deserves the strongest model |
| 5.4 | Progress UX polish (stage-level progress, friendly copy), mobile QA. | sonnet-4-6 | |
| 5.5 | README, runbook (deploy, rollback, queue redrive), cost notes. | haiku-4-5 | |

**Gate 5 (launch):** p50/p95 targets met; render success >97% over the load test; runbook validated by a cold deploy to a fresh Cloudflare account.

---

## Model budget summary

| Model | Where it's used | Why |
|---|---|---|
| claude-fable-5 | 1.1, 1.3, 2.2–2.4, 3.1–3.3, 5.3 | The auto-edit algorithm, FFmpeg graph compiler, CV reframe, reliability core, security — mistakes here are expensive |
| claude-opus-4-8 | 3.5, 5.1 | Deep-judgment tasks; also the fallback wherever Fable 5 isn't available |
| claude-sonnet-4-6 | Everything else (default) | Fast, strong implementation quality for well-specified tasks |
| claude-haiku-4-5 | 0.1, 0.3, 0.4, 1.5, 4.5, 5.5 | Boilerplate, config, docs |

## Standing instructions for the agent

1. Read Editium-PRD.md before every phase; if a task conflicts with the PRD, the PRD wins — flag the conflict rather than silently choosing.
2. Never merge past a failed gate.
3. Keep the timeline assembler and EDL compiler pure and unit-tested — no I/O in those modules.
4. Any new effect or style must be expressible as recipe JSON; if it can't be, extend the schema (task-2.2 owner model) rather than special-casing the engine.
5. Ask the human before: adding paid third-party services, changing the data model, or exceeding Cloudflare free-tier assumptions beyond what's listed in Phase 0 environment assumptions.
