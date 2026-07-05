# PRD — Djium: AI-Assisted DJ Studio

**Version:** 1.0
**Date:** 2026-07-06
**Audience:** Claude Code agent (autonomous implementation), human reviewer
**Status:** Ready for implementation planning (see `plan.md`)

---

## 1. Overview

Djium is a desktop-class web application (Electron-wrappable later) that helps hobbyist and semi-pro DJs build mixes. Users load audio from **local files** or connect **Spotify** for library browsing and playlist import. An AI layer suggests songs that blend well together, assists with transition construction (crossfade curves, EQ swaps, beatmatched cut points), and renders a final exportable mix.

### Elevator pitch
"Drag in your tracks, and Djium tells you what to play next, where to mix in, and how — then exports the finished set as a single file."

---

## 2. Critical technical constraint (read first)

**Spotify audio cannot be mixed or exported.** The Spotify Web API provides no raw audio access; Web Playback SDK streams are DRM-protected (EME) and cannot be routed through Web Audio for analysis, crossfading, or rendering. Spotify's `audio-features` and `audio-analysis` endpoints were deprecated for new applications in November 2024 and cannot be relied upon.

**Design consequence — the two-tier model:**

| Capability | Local files | Spotify |
|---|---|---|
| Browse library / import playlists | ✅ | ✅ |
| AI song suggestions (metadata-based) | ✅ | ✅ |
| BPM/key/beatgrid analysis | ✅ (in-app DSP) | ❌ (metadata + AI inference only) |
| Waveform display, cue points | ✅ | ❌ |
| Transition editing & preview | ✅ | ❌ |
| Export mix | ✅ | ❌ |

The UI must communicate this clearly: Spotify tracks appear with a "streaming only — link a local file to mix" badge, and the app should offer **track matching** (match a Spotify track to a local file by title/artist/duration fingerprint) so users can plan in Spotify and mix with their owned files.

---

## 3. Goals & non-goals

### Goals
1. Fast, reliable local-file mixing workflow: import → analyze → arrange → transition → export.
2. AI suggestions that meaningfully reduce "what next?" decision time (harmonic compatibility, BPM proximity, energy arc).
3. AI-assisted transitions: propose mix-in/mix-out points, crossfade length, EQ automation; user can accept, tweak, or override.
4. High-quality offline export (WAV/MP3/AAC) with correct gain staging.
5. Spotify as a discovery/planning surface, cleanly firewalled from audio processing.

### Non-goals (v1)
- Live performance mode / MIDI controller support.
- Stem separation (defer to v2; note it as an extension point).
- Mobile app.
- Cloud sync / multi-user collaboration.
- Recording from microphone/hardware inputs.

---

## 4. Users & core use cases

**Persona A — Bedroom DJ Ben:** owns a folder of MP3/FLAC files, wants to make a 60-minute mix for friends. Uses local pipeline end-to-end.

**Persona B — Playlist Planner Priya:** curates on Spotify, owns some tracks. Imports a Spotify playlist, gets AI ordering suggestions, matches what she owns to local files, mixes those, exports.

### Primary user journeys
1. **Import & analyze:** drag a folder → app analyzes BPM, musical key, beatgrid, energy, waveform → library populated.
2. **Build a set:** pick a starting track → AI suggests next tracks ranked by blend score → drag onto timeline.
3. **Craft a transition:** select two adjacent tracks → AI proposes transition (type, in/out points, curves) → user auditions and adjusts on a two-deck timeline editor.
4. **Export:** render entire timeline offline → progress UI → output file + cue sheet (.cue) + tracklist text.
5. **Spotify planning:** OAuth connect → browse/import playlists → AI ordering on metadata → match-to-local → continue journey 3–4.

---

## 5. Functional requirements

### 5.1 Library & import
- FR-1: Import local audio: MP3, WAV, FLAC, AAC/M4A, OGG. Drag-drop and file picker. Recursive folder import.
- FR-2: Extract metadata (ID3/Vorbis/MP4 tags): title, artist, album, art, genre, year.
- FR-3: Analysis pipeline per track (background, queued, cached):
  - BPM detection (onset detection + tempo estimation; confidence score).
  - Key detection (chromagram → Krumhansl or template matching; output Camelot notation).
  - Beatgrid (downbeat estimation, editable offset).
  - Energy curve (RMS/spectral flux over time, downsampled).
  - Waveform peaks file for rendering.
- FR-4: Library persisted locally (SQLite via better-sqlite3 or IndexedDB if browser-only — see plan for decision task).
- FR-5: Manual overrides: user can correct BPM (×2/÷2 buttons), key, beatgrid nudge.

### 5.2 Spotify integration
- FR-6: OAuth 2.0 PKCE flow; scopes: `playlist-read-private`, `user-library-read`. No playback scope needed for v1.
- FR-7: Import playlists and saved tracks as metadata records (title, artist, album, duration, ISRC where available).
- FR-8: Track matching: fuzzy match Spotify records to local library (normalized title/artist + duration ±2s; ISRC exact match when local tags contain it). Manual match/unmatch UI.
- FR-9: Graceful degradation: all Spotify features optional; app fully functional without connecting.

### 5.3 AI features
- FR-10: **Next-track suggestions.** Given current track (+ set history), rank candidate tracks by blend score:
  - Deterministic scoring layer: harmonic compatibility (Camelot wheel adjacency), BPM delta (within ±6% or half/double time), energy continuity.
  - LLM layer (Claude API): re-rank top candidates and generate a one-line "why" (vibe/genre/era coherence) using metadata + analysis summaries. LLM never sees raw audio; it sees structured JSON.
- FR-11: **Transition assistant.** For a selected track pair, propose 1–3 transition plans:
  - Deterministic layer computes candidate mix points (phrase boundaries from beatgrid, low-energy outro / intro regions) and feasibility (tempo stretch required).
  - LLM layer selects/labels plans ("32-bar blend with bass swap", "quick cut on the drop") and outputs a structured automation spec (JSON schema: fade curves, EQ node automation, tempo ramp).
  - App validates every LLM-produced spec against a strict schema; invalid output falls back to deterministic default.
- FR-12: **Set arc advisor (stretch goal):** given a target duration and vibe prompt, propose full ordering of a candidate pool.
- FR-13: All AI calls must have offline fallbacks (pure deterministic mode) and visible loading/error states. API key configurable via settings; never hardcoded.

### 5.4 Timeline & transition editor
- FR-14: Two-lane timeline (deck A/B alternating) with waveforms, beatgrid ticks, cue markers.
- FR-15: Transition region editor: draggable in/out points snapped to beats/phrases; crossfade curve editor (linear, equal-power, custom bezier); 3-band EQ automation lanes per deck; optional tempo ramp (time-stretch via SoundTouch/RubberBand WASM, preserve pitch).
- FR-16: Real-time preview through Web Audio API (AudioWorklet-based mixer graph); pre-listen from any point.
- FR-17: Undo/redo across all editing operations.

### 5.5 Export
- FR-18: Offline render of the full timeline using OfflineAudioContext (or native pipeline if Electron path chosen), applying identical DSP graph as preview.
- FR-19: Output formats: WAV (16/24-bit), MP3 (LAME WASM), AAC where licensing permits (document decision). Loudness normalization option (target −14 LUFS integrated, true peak −1 dBTP).
- FR-20: Export artifacts: audio file, `.cue` sheet with track boundaries, plain-text tracklist with timestamps.
- FR-21: Export must never include Spotify-sourced audio (enforced structurally: Spotify records have no audio pointer).

### 5.6 Settings & misc
- FR-22: Settings: Claude API key, audio output device, analysis quality preset, export defaults.
- FR-23: Crash-safe project files (autosave JSON project format, versioned schema).

---

## 6. Non-functional requirements

- NFR-1: Analysis throughput ≥ 5× realtime per track on a mid-range laptop (analysis in Web Workers/WASM).
- NFR-2: Preview latency: parameter changes audible < 50 ms; no audio dropouts during UI interaction (audio thread isolated in AudioWorklet).
- NFR-3: Export renders faster than realtime for typical 60-min mixes.
- NFR-4: All user audio stays on-device. Only metadata/analysis summaries are sent to the Claude API, and only when AI features are invoked. State this in a privacy note in-app.
- NFR-5: Deterministic outputs: same project + same settings → bit-identical export (excluding encoder nondeterminism).
- NFR-6: Test coverage: DSP and scoring modules ≥ 85% unit coverage; schema validation 100%.

---

## 7. System architecture (proposed)

```
┌────────────────────────────── UI (React + TypeScript) ─────────────────────────────┐
│ Library view · Spotify browser · Timeline editor · Transition editor · Export UI   │
└──────────────┬──────────────────────────────┬───────────────────────────┬──────────┘
               │                              │                           │
        State store (Zustand)          Audio Engine (Web Audio)      AI Service layer
               │                        - AudioWorklet mixer          - Claude API client
        Project persistence            - Transport/scheduler          - Prompt builders
        (SQLite / IndexedDB)           - Offline renderer             - JSON schema validators
               │                              │                           │
        Analysis workers (WASM: essentia.js or custom DSP; SoundTouch for stretch)
               │
        Spotify client (PKCE OAuth, metadata only)
```

**Key boundaries:**
- `core/dsp` — pure functions, no DOM, fully unit-testable.
- `core/scoring` — deterministic blend scoring; LLM re-ranker is a decorator over it.
- `ai/` — all Claude API interaction; every response validated with zod schemas; timeouts + retries + fallback.
- `audio/` — engine; the only module allowed to touch Web Audio.
- Spotify records are a distinct type (`StreamingTrackRef`) with **no** audio buffer field, making FR-21 unrepresentable rather than merely checked.

---

## 8. AI design details

### Model usage at runtime (in-app features)
- **Suggestions & transition specs:** `claude-sonnet-4-6` (quality/latency balance).
- **Cheap high-volume calls** (one-line blurbs, batch playlist annotation): `claude-haiku-4-5-20251001`.
- **Set arc advisor (stretch):** `claude-opus-4-8` or `claude-fable-5` behind a "deep plan" button, since it reasons over a whole pool.
- All prompts include: structured JSON of track analyses, strict output JSON schema in the system prompt, explicit instruction to output JSON only. Responses parsed defensively; on failure retry once, then deterministic fallback.

### Guardrails
- Max tokens capped; costs surfaced in settings.
- No lyrics or copyrighted text requested or stored.
- Telemetry of AI acceptance rate (did user keep the suggested transition?) stored locally to tune deterministic weights.

---

## 9. Milestones

| Milestone | Contents | Exit criteria |
|---|---|---|
| M0 – Skeleton | Repo, toolchain, CI, app shell | `pnpm dev` runs; CI green |
| M1 – Library | Import, tagging, analysis, persistence | 100-track folder analyzes with correct BPM on test corpus ≥ 90% |
| M2 – Playback & timeline | Engine, timeline UI, manual crossfades | Two tracks manually blended and auditioned |
| M3 – AI suggestions | Scoring + LLM re-rank | Suggestion latency < 3 s; fallback works offline |
| M4 – Transition assistant | Plan generation, editor integration | Accepted-plan preview matches spec |
| M5 – Export | Offline render, encoders, cue sheet | 60-min mix exports < realtime, loudness within ±0.5 LU of target |
| M6 – Spotify | OAuth, import, matching | Playlist import + ≥80% auto-match on test set |
| M7 – Polish | Undo/redo, settings, errors, docs | Bug bash clean; README + user guide |

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| BPM/key detection accuracy on edge genres | Bad suggestions | Confidence scores, manual override UI, curated test corpus |
| WASM time-stretch quality | Audible artifacts | Cap stretch to ±8%; prefer cut/echo-out transitions beyond that |
| LLM returns invalid specs | Broken transitions | Strict zod validation + deterministic fallback (FR-11) |
| Users expect Spotify mixing | Disappointment | Explicit UI messaging + track-matching flow (Section 2) |
| MP3/AAC encoder licensing | Legal | LAME is fine for MP3; make AAC optional/documented |

---

## 11. Open questions for the human

1. Browser-only PWA vs Electron from day one? (Plan assumes browser-first with an Electron-ready abstraction; flip if you want native file-system watching and lower-latency audio.)
2. Is a Spotify developer app already registered (client ID)?
3. Target platforms/browsers? (Plan assumes Chromium-first.)
4. Any licensing budget for RubberBand (higher-quality stretch) vs free SoundTouch?
