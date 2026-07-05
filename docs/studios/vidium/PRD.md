# Product Requirements Document (PRD)

## Product: **Vidium** — Browser-Based Video Editor

**Version:** 1.0
**Date:** July 2026
**Status:** Draft for engineering handoff (Claude Code)
**Target platform:** Web (desktop-first, responsive), hosted on Cloudflare

---

## 1. Overview

Vidium is a CapCut-style video editing application that runs entirely in the web browser. Users can import video, audio, and image assets, arrange them on a multi-track timeline, apply transitions, text overlays, filters, and effects, then export a finished video — all without installing software.

All heavy media processing happens **client-side** using the WebCodecs API (with an ffmpeg.wasm fallback), so the app can be hosted as a static site + lightweight APIs on Cloudflare's edge platform with no expensive server-side transcoding infrastructure.

### 1.1 Goals

1. A functional, performant in-browser video editor covering the core 80% of CapCut's editing workflow.
2. Fully deployable on Cloudflare (Pages/Workers + R2 + D1 + Durable Objects).
3. Zero server-side video processing in v1 — export happens in the browser.
4. Projects persist locally (OPFS/IndexedDB) and optionally to the cloud (R2 + D1).

### 1.2 Non-Goals (v1)

- Real-time multi-user collaborative editing (v2 candidate via Durable Objects).
- Mobile-native apps.
- AI features (auto-captions, background removal, TTS) — v2 candidates.
- Server-side rendering/export farm.
- 4K export (v1 caps at 1080p60 to keep browser export reliable).

---

## 2. Target Users & Use Cases

| Persona | Use case |
|---|---|
| Social media creator | Trim, caption, and export short-form vertical video (9:16) for TikTok/Reels/Shorts |
| Small business marketer | Combine product clips, add text/logo overlays, music, export 1:1 or 16:9 |
| Casual user | Trim a screen recording, cut mistakes, add background music |
| Educator | Stitch lecture clips, add title cards and simple transitions |

---

## 3. Functional Requirements

### 3.1 Project Management
- **FR-1.1** Create, rename, duplicate, delete projects.
- **FR-1.2** Project settings: resolution presets (16:9 1080p/720p, 9:16 1080×1920, 1:1 1080×1080), frame rate (24/30/60), background color.
- **FR-1.3** Autosave to OPFS/IndexedDB every 5 seconds (debounced) and on significant actions.
- **FR-1.4** Optional cloud sync: signed-in users can save project files + proxy assets to Cloudflare R2 with metadata in D1.
- **FR-1.5** Project file format: versioned JSON schema (`.vidium.json`) describing timeline, assets (by content hash), and settings. Assets stored separately.

### 3.2 Media Import & Asset Library
- **FR-2.1** Import via drag-and-drop, file picker, and paste. Supported: MP4/H.264, WebM/VP9, MOV (H.264), MP3, WAV, AAC, PNG, JPG, GIF, WebP.
- **FR-2.2** On import: demux + probe (duration, resolution, fps, codecs), generate filmstrip thumbnails and audio waveform peaks in a Web Worker.
- **FR-2.3** Asset library panel with search, sort, and preview-on-hover.
- **FR-2.4** Unsupported codec detection with clear error messaging; offer ffmpeg.wasm transcode-to-supported as fallback (with progress UI).
- **FR-2.5** Stock content tab (v1: a small bundled set of royalty-free music/SFX and title templates served from R2 behind Cloudflare CDN).

### 3.3 Timeline Editing
- **FR-3.1** Multi-track timeline: unlimited video/overlay tracks, unlimited audio tracks.
- **FR-3.2** Core operations: split (at playhead), trim (ripple and non-ripple), move, snap-to (playhead, clip edges, markers), copy/paste, duplicate, delete, undo/redo (min 100 steps, command-pattern based).
- **FR-3.3** Zoomable/scrollable timeline (pinch, ctrl+scroll, slider) from full-project view down to frame level.
- **FR-3.4** Clip speed control: 0.1×–10×, with optional pitch correction for audio.
- **FR-3.5** Keyboard shortcuts matching industry conventions (space = play/pause, S = split, Q/W = trim to playhead, ctrl+Z/Y, arrow keys = frame step).
- **FR-3.6** Markers on the timeline ruler.

### 3.4 Preview Player
- **FR-4.1** Real-time composited preview rendered via WebGL/WebGPU canvas, target ≥ 30 fps preview at 1080p on a mid-range laptop.
- **FR-4.2** Frame-accurate seeking and scrubbing (WebCodecs decode with keyframe-aware seek).
- **FR-4.3** Preview quality toggle (Full / Half / Quarter resolution) for performance.
- **FR-4.4** Safe-area and grid overlays; aspect-ratio letterboxing.
- **FR-4.5** Audio playback synced within ±1 frame of video (Web Audio API clock as master).

### 3.5 Effects, Transitions & Adjustments
- **FR-5.1** Transitions between adjacent clips: cut, cross-dissolve, fade to black/white, slide, wipe, zoom. Adjustable duration.
- **FR-5.2** Per-clip transform: position, scale, rotation, opacity, crop — all keyframable.
- **FR-5.3** Keyframe editor: add/remove/move keyframes, easing presets (linear, ease-in/out, bezier).
- **FR-5.4** Filters/adjustments (GPU shaders): brightness, contrast, saturation, temperature, hue, vignette, blur, sharpen + ~10 preset "looks" (LUT-based).
- **FR-5.5** Chroma key (green screen) with color picker, similarity, and smoothness controls.

### 3.6 Text & Stickers
- **FR-6.1** Text clips with font family (bundled open-source fonts + system fonts), size, color, stroke, shadow, background box, alignment, letter/line spacing.
- **FR-6.2** Text animation presets: fade, pop, typewriter, slide, karaoke-highlight.
- **FR-6.3** Basic title templates (lower thirds, centered titles, captions style).
- **FR-6.4** Image/sticker overlays with the same transform + keyframe system as video clips.

### 3.7 Audio
- **FR-7.1** Per-clip volume, fade in/out handles, mute; per-track volume and mute/solo.
- **FR-7.2** Waveform display on audio clips.
- **FR-7.3** Audio detach from video clip.
- **FR-7.4** Simple ducking helper: lower music under detected voice clips by a fixed dB (rule-based, not ML, in v1).

### 3.8 Export
- **FR-8.1** Export MP4 (H.264 + AAC) and WebM (VP9/AV1 + Opus) at project resolution up to 1080p60, selectable bitrate/quality presets.
- **FR-8.2** Export pipeline runs in Web Workers using WebCodecs encode + mp4-muxer/webm-muxer; must not freeze the UI; shows progress, ETA, cancel.
- **FR-8.3** Export target speed: ≥ 0.5× realtime for 1080p30 on a mid-range laptop (i.e., a 1-minute video exports in ≤ 2 minutes).
- **FR-8.4** GIF export for clips ≤ 15 s.
- **FR-8.5** Fallback: if WebCodecs H.264 encode is unavailable, use ffmpeg.wasm (slower) with user warning.

### 3.9 Accounts & Cloud (thin layer)
- **FR-9.1** Optional auth (email magic link or OAuth via a Workers-compatible auth library). App is fully usable anonymously with local-only projects.
- **FR-9.2** Cloud project list, save/load, and asset upload to R2 via presigned/direct-upload Worker endpoints.
- **FR-9.3** Shareable read-only project preview link (v1: renders the exported MP4 stored in R2, not a live editor).

---

## 4. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Initial editor load ≤ 3 s on broadband (code-split; ffmpeg.wasm lazy-loaded only when needed). Timeline interactions ≤ 16 ms frame budget. |
| Browser support | Chrome/Edge 120+, Safari 17+ (degraded: some codecs), Firefox latest (ffmpeg.wasm fallback where WebCodecs gaps exist). Feature-detect and message clearly. |
| Reliability | No data loss: autosave + crash recovery restore on reload. Export failures must be resumable or clearly reported. |
| Security | All uploads virus-scanned size/type-validated at the Worker; R2 objects private by default with signed URLs; strict CSP; COOP/COEP headers set (required for SharedArrayBuffer/ffmpeg.wasm threads). |
| Privacy | Anonymous mode processes everything locally; nothing leaves the device unless the user opts into cloud sync. |
| Accessibility | Keyboard-operable timeline and panels, focus states, WCAG 2.1 AA color contrast in UI chrome. |
| Cost | Pure static delivery + R2 egress via Cloudflare CDN; no server compute for rendering. |

---

## 5. Technical Architecture (summary — details in PLAN.md)

- **Frontend:** React + TypeScript + Vite. Zustand (or Redux Toolkit) for editor state with a command/undo system. Timeline UI in canvas (custom-rendered for performance). Preview compositor in WebGL2 (WebGPU progressive enhancement).
- **Media engine:** WebCodecs (decode/encode) + mp4box.js (demux) + mp4-muxer/webm-muxer (mux) in Web Workers; ffmpeg.wasm as universal fallback. OPFS for large local asset storage.
- **Hosting:** Cloudflare Pages (static app) or Workers Assets.
- **Backend (thin):** Cloudflare Workers (Hono) for auth, project metadata (D1), asset storage (R2 with direct-creator uploads), share links. Durable Objects reserved for v2 collaboration.
- **CI/CD:** GitHub Actions → Wrangler deploy to preview + production environments.

---

## 6. Success Metrics (v1)

- A user can import 3 clips, add a transition, text overlay, and music, and export a 1080p30 MP4 — end-to-end without documentation.
- Export success rate ≥ 95% across supported browsers in test matrix.
- Preview maintains ≥ 30 fps with 4 concurrent 1080p layers on reference hardware.
- Crash-recovery restores the last autosave 100% of the time in testing.

---

## 7. Release Plan

| Milestone | Scope |
|---|---|
| **M1 — Core engine** | Import, decode, preview single clip, project persistence |
| **M2 — Timeline MVP** | Multi-track timeline, trim/split/move, undo/redo, audio sync |
| **M3 — Creative tools** | Transitions, transforms + keyframes, filters, text, stickers |
| **M4 — Export** | WebCodecs export pipeline, presets, fallback path |
| **M5 — Cloud & polish** | Auth, R2 sync, share links, a11y, perf hardening, launch |

---

## 8. Open Questions

1. Should v1 bundle any licensed fonts beyond open-source (Inter, Noto, etc.)? *(Default: open-source only.)*
2. AV1 encode default for WebM where supported, or VP9 for compatibility? *(Default: VP9 default, AV1 optional.)*
3. Maximum project length cap for v1? *(Proposed: 30 minutes.)*
4. Do we need Safari day-one, or launch Chromium-first with a compatibility banner? *(Proposed: Chromium-first, Safari fast-follow.)*
