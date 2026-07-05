# PRD — Clipium: Longform → Shortform Clip Generator on Cloudflare

**Version:** 1.0 · **Date:** 2026-07-06 · **Audience:** Claude Code build agent

---

## 1. Overview

Clipium is a web application, hosted entirely on Cloudflare, that watches a YouTube channel for new longform uploads and automatically produces rendered, vertical (9:16), captioned short-form clips from the best moments of each video. The owner reviews clips in a dashboard, then downloads or exports them.

### 1.1 Problem
Creators publishing longform content (podcasts, streams, tutorials) need short-form derivatives for YouTube Shorts / TikTok / Reels. Manually scrubbing hours of footage to find hooks, cutting, reframing to vertical, and captioning is slow and repetitive.

### 1.2 Goal
Zero-touch pipeline: new upload detected → transcribed → best moments identified by an LLM → clips rendered as 9:16 MP4s with burned-in word-timed captions → surfaced in a review dashboard within ~30 minutes of upload.

### 1.3 Non-goals (v1)
- Direct publishing to TikTok/Shorts/Reels APIs (v2)
- Multi-channel / multi-tenant support (single channel, single owner)
- Face tracking / smart reframing beyond center-crop with configurable focus region (v2: speaker detection)
- Editing timeline UI (v1 offers trim-nudge only: adjust in/out points and re-render)

### 1.4 Legal constraint
The app downloads source video via yt-dlp. This is intended **only for channels the user owns or has rights to repurpose**. The setup flow must display this constraint and require an acknowledgment checkbox before a channel can be connected.

---

## 2. Users & core user stories

Single persona: **Channel Owner** (also the operator).

1. As an owner, I connect my YouTube channel by ID/handle so new uploads are detected automatically.
2. As an owner, when I upload a longform video, I receive 3–8 candidate clips without doing anything.
3. As an owner, I open a dashboard, watch each candidate clip, see its hook/title/virality rationale, and approve, reject, or nudge trim points.
4. As an owner, I download approved clips as MP4 (and .srt separately if I want).
5. As an owner, I can also paste a URL for a back-catalog video to process on demand (secondary trigger; auto-detect is primary).
6. As an owner, I can set preferences: clip length range (e.g. 20–60s), max clips per video, caption style (font, colors, position), and focus-crop region default.

---

## 3. Functional requirements

### FR-1 Channel watching
- Subscribe to the channel via **YouTube WebSub (PubSubHubbub)** push notifications to a Worker callback URL; renew leases automatically (Cron Trigger).
- Fallback: Cron Trigger polls the channel's uploads playlist (YouTube Data API v3) every 15 min in case a WebSub notification is missed.
- Deduplicate: a video ID is processed at most once unless the owner explicitly re-runs it.
- Ignore videos shorter than a configurable threshold (default 8 min) and live broadcasts until they finish.

### FR-2 Ingestion & transcription
- Download source media (best ≤1080p video + audio) via **yt-dlp inside a Cloudflare Container**; store in R2 under `sources/{videoId}/`.
- Transcribe with **Workers AI Whisper (`@cf/openai/whisper-large-v3-turbo`)** requesting word-level timestamps; chunk audio as needed for model limits. Store transcript JSON (words + timestamps + segments) in R2 and index metadata in D1.
- If Workers AI transcription fails or word timestamps are unavailable, fall back to running `whisper.cpp` (or faster-whisper) inside the Container.

### FR-3 Moment selection (LLM)
- Send the full transcript (with timestamps) to the **Claude API** to identify the best 3–8 self-contained moments, honoring the owner's clip-length preferences.
- Output contract (strict JSON): for each moment — `start`, `end` (seconds, snapped to word boundaries), `hook_line`, `title`, `rationale`, `confidence` (0–1), `keywords`.
- Prompt criteria: strong hook in the first ~2 seconds, self-contained arc (no dangling context), emotional peaks / contrarian claims / concrete payoffs, natural sentence boundaries, no mid-word cuts.
- Model: `claude-sonnet-4-6` (long-transcript reasoning at reasonable cost). Expose model ID in config so it can be upgraded (e.g. to `claude-fable-5`) without code changes.
- Second pass with `claude-haiku-4-5-20251001`: generate per-clip caption copy (post description, hashtags) and validate the JSON contract.

### FR-4 Rendering
- Cloudflare **Container** job per clip: ffmpeg cuts `[start, end]`, scales/crops to 1080×1920 (center crop by default; focus region from settings), burns in captions from word-timestamped ASS subtitles (active-word highlight style), normalizes loudness (EBU R128), outputs H.264/AAC MP4 ≤60s.
- Also emit a standalone `.srt` per clip.
- Store outputs in R2 under `clips/{videoId}/{clipId}.mp4`; serve to the dashboard via signed URLs or an authenticated Worker route.

### FR-5 Orchestration
- **Cloudflare Queues** connect the stages: `detect → download → transcribe → select → render(×N) → finalize`.
- Job state machine persisted in **D1**: `queued | downloading | transcribing | selecting | rendering | ready | partial_failure | failed`, with per-stage timestamps, retry counts (max 3, exponential backoff), and error messages.
- A stalled job watchdog (Cron) re-queues or fails jobs stuck >30 min in one stage.

### FR-6 Dashboard (web UI)
- Cloudflare Workers static assets (or Pages) serving a lightweight SPA.
- Views: **Queue** (in-flight jobs with stage progress), **Review** (per-video grid of candidate clips: inline player, title, hook, rationale, confidence; approve / reject / nudge in-out ±5s and re-render), **Library** (approved clips, download MP4/SRT), **Settings** (channel connection, clip prefs, caption style with live preview, API keys status).
- Access control: single-owner login via **Cloudflare Access** (Zero Trust) in front of the app; no self-built auth in v1.

### FR-7 Manual trigger
- "Process a video" input accepting a YouTube URL/ID from the connected channel; enters the same pipeline; rejected with a clear message if the video belongs to a different channel (override checkbox exists but re-shows the rights acknowledgment).

---

## 4. Non-functional requirements

- **Latency:** ≤30 min from upload notification to clips ready for a 2-hour source video (p90).
- **Cost ceiling:** design for <$0.50 per processed hour of source video (Workers AI + Claude API + Container compute), logged per job in D1.
- **Reliability:** any single-stage failure retries without redoing completed stages (artifacts in R2 are the checkpoint).
- **Security:** secrets (YouTube API key, Anthropic API key) in Worker secrets/Secrets Store, never in code or D1; R2 buckets private; all dashboard routes behind Cloudflare Access.
- **Observability:** structured logs per job stage; a `/health` endpoint; failure notifications via email (MailChannels/Email Workers) optional toggle.

---

## 5. Architecture summary

| Concern | Cloudflare primitive |
|---|---|
| API + dashboard | Worker (Hono) + static assets |
| Upload detection | WebSub callback Worker + Cron fallback poller |
| Job orchestration | Queues + D1 state machine |
| Heavy compute (yt-dlp, ffmpeg, whisper fallback) | Containers (Durable Object–backed) |
| Transcription | Workers AI Whisper |
| Moment selection & copy | Claude API (Sonnet 4.6 / Haiku 4.5) |
| Storage: media & transcripts | R2 |
| Metadata & job state | D1 |
| Auth | Cloudflare Access |
| Config/secrets | Wrangler secrets / Secrets Store |

Data flow: WebSub ping → Worker verifies + enqueues → Container downloads to R2 → Worker chunks audio → Workers AI transcribes → Worker calls Claude for moments → Queue fans out render jobs → Containers render to R2 → D1 marked `ready` → dashboard shows clips.

---

## 6. Claude model assignments

### 6.1 Runtime (inside the app)
| Task | Model | Why |
|---|---|---|
| Moment selection from full transcript | `claude-sonnet-4-6` | Long-context reasoning over hour-plus transcripts; best quality/cost for the core judgment task |
| Titles, hooks, post copy, hashtags | `claude-haiku-4-5-20251001` | High-volume, low-complexity generation; cheap and fast |
| JSON contract validation / repair | `claude-haiku-4-5-20251001` | Trivial structured task |
| Optional "quality" mode toggle | `claude-fable-5` | Owner-selectable upgrade for moment selection on flagship videos |

### 6.2 Build time (Claude Code agent) — see Clipium-plan.md for per-task detail
| Work type | Model |
|---|---|
| Architecture decisions, pipeline/state-machine design, prompt engineering for FR-3 | Opus 4.8 (or Fable 5 if available) |
| Feature implementation (Workers, Containers, dashboard) | Sonnet 4.6 |
| Boilerplate, config files, test scaffolding, docs | Haiku 4.5 |

Verify current model IDs and capabilities against https://docs.claude.com/en/api/overview before pinning versions.

---

## 7. Success metrics (v1)

- ≥80% of auto-generated clips are approved without trim adjustments (owner-rated over first 20 videos).
- Pipeline success rate ≥95% of detected uploads reach `ready` without manual intervention.
- p90 end-to-end latency ≤30 min for 2-hour sources.
- Cost per source-hour within ceiling, visible per job.

---

## 8. Open questions / v2 candidates

1. Speaker-aware reframing (active-speaker crop) via a vision model in the Container.
2. Direct publishing integrations (YouTube Shorts API, TikTok Content Posting API).
3. Multi-channel + team review workflow.
4. A/B hook variants: render two intro variants per clip.
5. B-roll/zoom emphasis keyed to caption emphasis words.
