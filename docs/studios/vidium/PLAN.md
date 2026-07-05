# PLAN.md — Vidium Implementation Plan for Claude Code

This plan is written to be executed by **Claude Code**. Each task specifies **which Claude model to use**, based on complexity:

| Model | Model string | Use for |
|---|---|---|
| **Claude Opus 4.8** | `claude-opus-4-8` | Architecture decisions, the media/compositing engine, export pipeline, timeline core, gnarly cross-browser debugging |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | Standard feature implementation: UI components, panels, state wiring, Workers API endpoints, most tests |
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | Boilerplate, config files, CRUD scaffolding, lint fixes, doc comments, simple refactors |

> Tip: switch models per task with `/model` in Claude Code, or run cheap tasks in parallel worktrees on Haiku while Opus handles engine work. General rule: **if the task touches WebCodecs, A/V sync, the compositor, or export — use Opus. If it's a panel, a form, or a REST endpoint — Sonnet. If it's config or repetitive — Haiku.**

---

## Tech Stack (decided)

- **App:** React 18 + TypeScript + Vite, Zustand + command-pattern undo, Tailwind CSS
- **Media:** WebCodecs, mp4box.js (demux), mp4-muxer & webm-muxer (mux), ffmpeg.wasm (fallback, lazy-loaded), Web Audio API, OPFS + IndexedDB
- **Rendering:** WebGL2 compositor (custom), canvas-rendered timeline
- **Edge:** Cloudflare Pages (static) + Workers (Hono) + R2 (assets/exports) + D1 (metadata) + KV (sessions)
- **Tooling:** pnpm monorepo (`apps/web`, `workers/api`, `packages/engine`, `packages/ui`), Vitest + Playwright, GitHub Actions + Wrangler

---

## Phase 0 — Project Setup

| # | Task | Model |
|---|---|---|
| 0.1 | Scaffold pnpm monorepo, Vite React TS app, Tailwind, ESLint/Prettier, tsconfig project refs | **Haiku 4.5** |
| 0.2 | Wrangler config: Pages project, Workers API skeleton (Hono), D1 + R2 + KV bindings, preview/prod envs | **Sonnet 4.6** |
| 0.3 | Set COOP/COEP headers (`_headers` / Worker middleware) — required for SharedArrayBuffer (ffmpeg.wasm threads); verify `crossOriginIsolated === true` | **Sonnet 4.6** |
| 0.4 | GitHub Actions CI: typecheck, lint, unit tests, Playwright smoke, Wrangler deploy to preview on PR / prod on main | **Sonnet 4.6** |
| 0.5 | Write `ARCHITECTURE.md`: module boundaries, data flow diagram, engine/UI contract, project JSON schema v1 | **Opus 4.8** |

**Exit criteria:** empty app deploys to Cloudflare preview + prod; CI green; cross-origin isolation verified.

---

## Phase 1 — Media Engine Core (`packages/engine`)

The hardest code in the project. Keep it framework-free (pure TS + Workers) so it's testable and portable.

| # | Task | Model |
|---|---|---|
| 1.1 | **Asset ingest worker:** file → mp4box.js demux → probe metadata (duration, fps, resolution, codecs); WebM/Matroska probe; store originals in OPFS keyed by content hash | **Opus 4.8** |
| 1.2 | **Decode pipeline:** WebCodecs VideoDecoder wrapper with keyframe-aware seeking, frame cache (ring buffer), backpressure handling | **Opus 4.8** |
| 1.3 | **Audio pipeline:** AudioDecoder → PCM ring buffer → Web Audio graph; master clock design (audio clock drives video presentation) | **Opus 4.8** |
| 1.4 | **Thumbnail/waveform generation** in workers: filmstrip JPEGs at N intervals; waveform peak files | **Sonnet 4.6** |
| 1.5 | **ffmpeg.wasm fallback module:** lazy-load, transcode-unsupported-input flow, progress events | **Sonnet 4.6** |
| 1.6 | **Capability detection:** feature-detect WebCodecs codecs (encode + decode), build support matrix object consumed by UI | **Sonnet 4.6** |
| 1.7 | Engine unit tests with sample fixtures (tiny mp4/webm/mp3 files committed to repo) | **Sonnet 4.6** |
| 1.8 | Doc comments + engine README | **Haiku 4.5** |

**Exit criteria:** given a video file, engine can seek to any timestamp and return a decoded `VideoFrame` + synced audio, in a worker, with tests.

---

## Phase 2 — Compositor & Preview Player

| # | Task | Model |
|---|---|---|
| 2.1 | **WebGL2 compositor:** layer stack → textures → transform (position/scale/rotation/opacity/crop) → blend → output canvas; texture pooling | **Opus 4.8** |
| 2.2 | **Playback scheduler:** timeline time → per-track frame requests → composite → present; A/V sync to Web Audio clock; drop-frame strategy | **Opus 4.8** |
| 2.3 | Preview player UI: transport controls, scrub bar, quality toggle, safe-area/grid overlays, letterboxing | **Sonnet 4.6** |
| 2.4 | Shader library: adjustments (brightness/contrast/saturation/temp/hue), blur, sharpen, vignette, LUT loader + 10 preset looks | **Sonnet 4.6** |
| 2.5 | Chroma key shader with similarity/smoothness uniforms | **Opus 4.8** |
| 2.6 | Perf instrumentation: fps meter, decode/composite timings, dev overlay | **Haiku 4.5** |

**Exit criteria:** 4 × 1080p layers composite at ≥ 30 fps preview; scrubbing is frame-accurate; audio stays within ±1 frame.

---

## Phase 3 — Project Model, State & Timeline UI

| # | Task | Model |
|---|---|---|
| 3.1 | **Project schema v1** (zod): tracks, clips, keyframes, transitions, assets-by-hash; serialization + versioned migrations | **Opus 4.8** |
| 3.2 | **Command system:** every edit is a Command (do/undo/redo, coalescing for drags), 100+ step history | **Opus 4.8** |
| 3.3 | Zustand stores: project, selection, playback, UI panels; engine ↔ store bridge | **Sonnet 4.6** |
| 3.4 | **Canvas timeline renderer:** tracks, clips (filmstrips + waveforms), ruler, playhead, zoom/scroll (virtualized) | **Opus 4.8** |
| 3.5 | Timeline interactions: select, drag-move, trim handles (ripple + normal), split at playhead, snapping, marquee select, context menu | **Opus 4.8** |
| 3.6 | Clip speed control incl. audio pitch-preserve toggle (via AudioWorklet time-stretch or playbackRate) | **Sonnet 4.6** |
| 3.7 | Keyboard shortcut system + shortcut cheat-sheet modal | **Sonnet 4.6** |
| 3.8 | Autosave (debounced 5 s) to OPFS/IndexedDB + crash-recovery restore flow | **Sonnet 4.6** |
| 3.9 | Markers, copy/paste/duplicate, delete-with-ripple option | **Sonnet 4.6** |
| 3.10 | Timeline unit + interaction tests (Playwright component tests) | **Sonnet 4.6** |

**Exit criteria:** full trim/split/move/undo editing of multi-track projects; reload restores state; interactions stay under 16 ms.

---

## Phase 4 — Creative Tools

| # | Task | Model |
|---|---|---|
| 4.1 | **Keyframe engine:** parameter tracks, easing (linear/ease/bezier), evaluation at time t; integrates with compositor uniforms | **Opus 4.8** |
| 4.2 | Keyframe editor UI (diamonds on clips + inspector curves) | **Sonnet 4.6** |
| 4.3 | Transitions engine (cross-fade rendering of two clips) + 6 transition shaders (dissolve, fades, slide, wipe, zoom) | **Opus 4.8** |
| 4.4 | Transition picker UI + duration handles on timeline | **Sonnet 4.6** |
| 4.5 | **Text rendering:** styled text → canvas → texture; fonts (bundled + system), stroke/shadow/box; caching | **Opus 4.8** |
| 4.6 | Text inspector panel + 5 animation presets (fade, pop, typewriter, slide, karaoke) + title templates | **Sonnet 4.6** |
| 4.7 | Sticker/image overlay clips (reuse transform/keyframes) + GIF decode support | **Sonnet 4.6** |
| 4.8 | Adjustments/filters inspector panel wired to shader uniforms with keyframe support | **Sonnet 4.6** |
| 4.9 | Audio tools: volume/fade handles, track mute/solo, detach audio, rule-based ducking | **Sonnet 4.6** |
| 4.10 | Asset library panel: import (drag/drop/paste), search/sort, hover preview; stock tab pulling from R2 | **Sonnet 4.6** |

**Exit criteria:** the full CapCut-core feature set is usable end-to-end in preview.

---

## Phase 5 — Export Pipeline

| # | Task | Model |
|---|---|---|
| 5.1 | **Export orchestrator (worker):** frame-by-frame render via compositor (OffscreenCanvas) → VideoEncoder; audio mixdown → AudioEncoder; mux with mp4-muxer/webm-muxer; progress/ETA/cancel; memory-bounded pipelining | **Opus 4.8** |
| 5.2 | Export presets & settings UI (format, resolution, fps, bitrate/quality) driven by capability matrix | **Sonnet 4.6** |
| 5.3 | ffmpeg.wasm export fallback path (when H.264 encode unsupported) with user warning | **Sonnet 4.6** |
| 5.4 | GIF export (≤ 15 s) via gifenc | **Haiku 4.5** |
| 5.5 | Export QA matrix: verify output in Chrome/Edge/Safari/Firefox, VLC, QuickTime; A/V sync validation script | **Opus 4.8** |

**Exit criteria:** 1-minute 1080p30 project exports in ≤ 2 min on reference hardware; files play everywhere in the matrix.

---

## Phase 6 — Cloud Layer (Workers API)

| # | Task | Model |
|---|---|---|
| 6.1 | Auth: magic-link email (Workers + KV sessions) and/or OAuth; anonymous mode untouched | **Sonnet 4.6** |
| 6.2 | D1 schema + migrations: users, projects, assets, share_links | **Haiku 4.5** |
| 6.3 | Project sync endpoints: save/load project JSON to R2, metadata in D1; conflict = last-write-wins with local backup | **Sonnet 4.6** |
| 6.4 | Direct-to-R2 asset uploads (presigned/direct-creator upload), size/type validation, content-hash dedupe | **Sonnet 4.6** |
| 6.5 | Share links: upload exported MP4 to R2 → signed public URL + minimal player page | **Sonnet 4.6** |
| 6.6 | Rate limiting, CSP, security headers audit | **Sonnet 4.6** |
| 6.7 | API integration tests (Vitest + Miniflare/workerd) | **Sonnet 4.6** |

**Exit criteria:** sign in, sync a project across two browsers, share an export link.

---

## Phase 7 — Polish, A11y, Performance & Launch

| # | Task | Model |
|---|---|---|
| 7.1 | Performance hardening: code-splitting audit, lazy ffmpeg.wasm, memory-leak hunt (VideoFrame.close() audits), long-project stress test | **Opus 4.8** |
| 7.2 | Cross-browser bug bash & fixes (Safari WebCodecs quirks, Firefox fallbacks) | **Opus 4.8** |
| 7.3 | Accessibility pass: keyboard nav, focus management, ARIA on panels, contrast | **Sonnet 4.6** |
| 7.4 | Onboarding: empty-state, sample project, 5-step tour | **Sonnet 4.6** |
| 7.5 | Error handling & telemetry (client error reporting Worker, no PII) | **Sonnet 4.6** |
| 7.6 | Landing page + docs/help pages | **Haiku 4.5** |
| 7.7 | Final Playwright E2E: import → edit → export happy path in CI | **Sonnet 4.6** |

**Exit criteria:** PRD success metrics met; launch checklist green.

---

## Suggested Claude Code Workflow

1. **One phase = one milestone.** Work top-to-bottom; exit criteria gate each phase.
2. **Model switching:** start sessions on Sonnet 4.6 by default; `/model claude-opus-4-8` for any task marked Opus before starting it; batch Haiku tasks together.
3. **Engine-first discipline:** `packages/engine` must never import React. Enforce with an ESLint boundary rule (task 0.1).
4. **Fixtures over mocks:** commit tiny real media files for engine tests; WebCodecs behavior can't be meaningfully mocked.
5. **Deploy every PR** to a Cloudflare preview URL; test media features in a real browser via Playwright headed mode, since headless lacks some codec support.
6. **Definition of done per task:** code + tests + types clean + short note in `CHANGELOG.md`.

## Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Safari/Firefox WebCodecs gaps | Capability matrix (1.6) drives UI; ffmpeg.wasm fallback; Chromium-first launch |
| Browser memory limits on long exports | Streamed, memory-bounded pipeline (5.1); 1080p/30-min caps in v1 |
| A/V desync | Audio-clock-master design (1.3); automated sync validation (5.5) |
| OPFS quota exhaustion | Quota checks on import, eviction UI, warn at 80% |
| Timeline perf with many clips | Canvas virtualization (3.4); perf budget tests in CI |
