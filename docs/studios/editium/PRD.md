# PRD: Editium — Viral Sports Edit Generator

**Version:** 1.0
**Date:** 2026-07-06
**Status:** Draft — ready for implementation planning
**Target platform:** Cloudflare (Workers, Pages, R2, D1, Queues, Containers, Stream)

---

## 1. Overview

### 1.1 Problem
Creating a viral-quality sports edit (the kind that performs on TikTok/Instagram Reels) currently requires CapCut/Premiere skills: beat-syncing cuts to music, adding speed ramps, zoom punches, flashy transitions, captions, and grading. Most people with great raw clips never post them because editing takes 1–3 hours.

### 1.2 Solution
A web app where a user uploads one or more raw sports clips, picks a music track and an edit style, and the system automatically produces a polished, vertical (9:16), share-ready edit in minutes. Zero timeline editing required.

### 1.3 Goals
- Upload-to-finished-edit in under 5 minutes for a 30–60 second output.
- Output quality that is indistinguishable from a competent human CapCut edit.
- Fully hosted on Cloudflare's platform (no AWS/GCP dependencies).
- Mobile-first web UI (most users will upload from their phone).

### 1.4 Non-goals (v1)
- Manual timeline editing / keyframe control.
- Direct posting to TikTok/Instagram APIs (v1 outputs a downloadable MP4; direct publishing is v2).
- User accounts, teams, or payment (v1 is single-user or link-gated).
- Live-stream clipping.

---

## 2. Users & Use Cases

| User | Use case |
|---|---|
| Amateur athlete / parent | Films games on phone, wants highlight reels of themselves/their kid |
| Team social media admin | Turns weekend match footage into recruitment/hype content |
| Sports content creator | High volume of edits, needs speed over fine control |

**Primary user story:** "As a creator, I upload 3–8 raw clips from Saturday's game, pick 'Hype' style and a track, and get back a 45-second vertical edit with beat-synced cuts, slow-mo on the best moments, and captions — ready to post."

---

## 3. Core Features

### 3.1 Clip Upload
- Drag-and-drop / tap-to-upload, multi-file (up to 10 clips, 500 MB total, MP4/MOV/WebM).
- Direct-to-R2 multipart upload via presigned URLs (uploads must not pass through a Worker request body).
- Client-side thumbnail preview and reordering.
- Upload resume on flaky mobile connections.

### 3.2 Music Selection
- v1: curated library of ~20 royalty-free/licensed tracks stored in R2, tagged by energy/genre, with pre-computed beat grids (onset timestamps stored as JSON alongside each track).
- User can also upload their own audio (they own the licensing responsibility; show a disclaimer).
- Beat detection for user-uploaded audio runs in the render container (librosa/aubio).

### 3.3 Edit Styles (Templates)
Ship v1 with 4 styles. Each style is a declarative JSON "recipe" the render engine interprets — adding a style must never require engine changes.

| Style | Character |
|---|---|
| **Hype** | Fast beat-synced cuts, zoom punches on beats, flash/shake transitions, high-contrast grade |
| **Cinematic** | Slow-mo emphasis, letterbox option, smooth crossfades, filmic LUT |
| **Retro/VHS** | Grain, chromatic aberration, timestamp overlay, jump cuts |
| **Clean** | Minimal cuts, subtle punch-ins, whip transitions, natural grade |

### 3.4 Auto-Editing Engine (the core IP)
Pipeline stages:
1. **Ingest & normalize** — probe clips (ffprobe), transcode to a mezzanine format, extract frames/audio.
2. **Moment detection** — score each clip for "interesting" segments using: motion intensity (optical-flow magnitude), scene changes, audio energy spikes (crowd noise, ball contact), and optionally an LLM/vision pass ranking candidate segments. Output: ranked list of segments with in/out points.
3. **Timeline assembly** — fit the best segments to the music's beat grid according to the style recipe: cut points land on beats, best moment gets slow-mo aligned to the drop, clip order respects user ordering unless "auto-arrange" is enabled.
4. **Effects & framing** — 9:16 auto-reframe (subject tracking to keep the action centered), speed ramps, zoom punches, transitions, color grade/LUT per style.
5. **Captions (optional)** — user-entered hook text ("HE DID NOT JUST DO THAT 😳") rendered as an animated headline in the first 1.5 s; optional auto-generated hook suggestions via Claude API.
6. **Render & mux** — FFmpeg render to H.264 MP4, 1080×1920, 30 fps, AAC audio, faststart. Also produce a 3-second animated preview thumbnail (WebP).

### 3.5 Preview & Iterate
- Job status page with live progress (queued → analyzing → assembling → rendering → done) via polling or SSE.
- On completion: in-browser playback (served from R2 or Cloudflare Stream), download button.
- "Remix" button: re-run with a different style/track without re-uploading (reuses analysis artifacts).

### 3.6 Output & Sharing
- Download MP4 (primary).
- Shareable link page with OG tags and the animated preview.
- Outputs auto-expire from R2 after 7 days (configurable) to control storage cost.

---

## 4. Architecture (Cloudflare)

```
Browser (Pages: React/Vite app)
   │  presigned multipart upload
   ▼
R2 (raw-clips bucket)
   │
Worker API (Hono) ──► D1 (jobs, clips, styles metadata)
   │ enqueue
   ▼
Cloudflare Queue (render-jobs)
   │ consumed by
   ▼
Cloudflare Container (Python + FFmpeg + analysis libs)
   │ writes
   ▼
R2 (renders bucket) ──► served via Worker w/ signed URLs (or Cloudflare Stream)
```

- **Frontend:** React + Vite + Tailwind, deployed as static assets on the Worker (Workers Assets) or Pages.
- **API:** single Worker using Hono. Endpoints: create upload session, complete upload, create job, get job status, list styles/tracks, get output URL.
- **State:** D1 (SQLite) for jobs/clips/styles; Durable Object per job for progress fan-out if SSE is used (optional — polling D1 is acceptable for v1).
- **Render workers:** Cloudflare Containers image with FFmpeg, Python, OpenCV, librosa. Container pulls job payload, streams inputs from R2, renders, uploads output, updates job row, acks queue message.
- **Optional AI:** Workers AI or Claude API (Haiku) for caption/hook suggestions and segment ranking assistance.

### 4.1 Key technical risks
| Risk | Mitigation |
|---|---|
| Container CPU/memory/time limits vs. long renders | Cap input duration (10 min total), mezzanine at 720p for analysis, render at 1080p only at final stage; chunk long renders |
| Auto-reframe quality (subject drifting out of frame) | Start with motion-centroid tracking + smoothing; fall back to center crop; expose "focus point" tap in UI as v1.1 |
| Beat detection accuracy on user audio | Curated library ships with hand-verified beat grids; user audio gets aubio onset detection with confidence threshold |
| Mobile upload reliability | R2 multipart with resume; keep parts ≤10 MB |

---

## 5. Data Model (D1)

- `jobs` (id, status, style_id, track_id, params_json, created_at, completed_at, output_key, preview_key, error)
- `clips` (id, job_id, r2_key, order_index, duration_s, probe_json, analysis_json)
- `styles` (id, name, recipe_json, enabled)
- `tracks` (id, name, r2_key, bpm, beat_grid_json, tags)

---

## 6. API Surface (v1)

- `POST /api/uploads` → presigned multipart URLs
- `POST /api/uploads/:id/complete`
- `POST /api/jobs` → { clipIds[], styleId, trackId | uploadedTrackId, captionText?, autoArrange }
- `GET /api/jobs/:id` → status + progress + output URLs when done
- `POST /api/jobs/:id/remix` → new job reusing analysis
- `GET /api/styles`, `GET /api/tracks`

---

## 7. Success Metrics
- Time from last upload byte → downloadable output: p50 < 3 min, p95 < 8 min (for ≤60 s output).
- Render success rate > 97%.
- "Remix" usage > 30% of completed jobs (signals users iterating, not abandoning).
- Qualitative: 5 test users rate output ≥4/5 vs. "would post this."

## 8. Milestones
1. **M1 — Walking skeleton:** upload → queue → container runs FFmpeg concat → download. No intelligence.
2. **M2 — Beat-synced assembly:** curated tracks, beat-grid cutting, one style (Hype), vertical crop (center).
3. **M3 — Moment detection + smart reframe:** motion/audio scoring, subject tracking crop, slow-mo placement.
4. **M4 — Full style pack + captions + remix + share pages.**
5. **M5 — Polish:** progress UX, error handling, output expiry, load testing.

## 9. Out-of-scope / v2 candidates
Direct TikTok/IG publishing, accounts & billing, team libraries, AI voiceover, auto-generated hook text A/B variants, watermark removal tiers, live-clip ingestion.
