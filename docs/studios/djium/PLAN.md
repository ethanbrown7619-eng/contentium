# plan.md — Djium implementation plan for Claude Code

**Companion to:** `Djium-PRD.md` (read it fully before starting; Section 2's Spotify constraint is load-bearing)
**Execution mode:** phased, each phase ends with passing tests + a human checkpoint.

---

## Model assignment strategy

Use `/model` in Claude Code (or `--model` per session) to switch. Rules of thumb used below:

| Model | API string | Use for |
|---|---|---|
| **Claude Opus 4.8** | `claude-opus-4-8` | Architecture decisions, DSP algorithms (BPM/key/beatgrid), audio engine scheduling, offline renderer, prompt/schema design — anything where a subtle bug is expensive |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | The default workhorse: feature implementation, UI, integrations, refactors, most debugging |
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | Boilerplate, config, test scaffolding from existing patterns, docs, small fixes |

If available on your plan, `claude-fable-5` can substitute for Opus on the hardest tasks (Phase 2 DSP and Phase 5 renderer) — it's Anthropic's most capable generally available model. Verify current model availability with `claude --help` / docs before starting: https://docs.claude.com/en/api/overview

**Runtime models inside the app itself** (what the app calls, independent of what builds it): Sonnet 4.6 for suggestions/transition specs, Haiku 4.5 for cheap annotations, Opus 4.8/Fable 5 for the optional "deep set plan" feature. See Djium-PRD §8.

---

## Phase 0 — Project skeleton *(Milestone M0)*

| # | Task | Model | Notes |
|---|---|---|---|
| 0.1 | Decide browser-PWA vs Electron; document ADR-001 (default: Vite + React + TS browser app with a `platform/` abstraction for file access so Electron can slot in later) | **Opus 4.8** | Architecture decision, cascades everywhere |
| 0.2 | Scaffold repo: Vite, React 18, TypeScript strict, pnpm, ESLint/Prettier, Vitest, Playwright | Haiku 4.5 | Pure boilerplate |
| 0.3 | CI (GitHub Actions): typecheck, lint, unit tests, build | Haiku 4.5 | |
| 0.4 | Define core domain types: `LocalTrack`, `StreamingTrackRef` (no audio field — see PRD FR-21), `AnalysisResult`, `Project`, `TimelineClip`, `TransitionSpec` + zod schemas | **Opus 4.8** | Type design here prevents whole bug classes |
| 0.5 | State store setup (Zustand) + persistence layer decision (IndexedDB via Dexie for browser path); ADR-002 | Sonnet 4.6 | |

**Checkpoint:** app shell renders, CI green, ADRs written.

---

## Phase 1 — Library & analysis *(M1)*

| # | Task | Model | Notes |
|---|---|---|---|
| 1.1 | File import (drag-drop, picker, recursive folder via File System Access API) + tag parsing (`music-metadata`) | Sonnet 4.6 | |
| 1.2 | Web Worker analysis pipeline harness (queue, progress events, result caching keyed by file hash) | Sonnet 4.6 | |
| 1.3 | **BPM + onset detection** (evaluate essentia.js vs custom; implement with confidence score, half/double-time disambiguation) | **Opus 4.8** | Core DSP; correctness gates all AI quality |
| 1.4 | **Key detection** (chromagram → template matching → Camelot output) | **Opus 4.8** | Core DSP |
| 1.5 | **Beatgrid & downbeat estimation** with manual nudge/offset model | **Opus 4.8** | Core DSP |
| 1.6 | Energy curve + waveform peaks generation (downsampled, stored) | Sonnet 4.6 | Straightforward once 1.3 exists |
| 1.7 | Library UI: table, search/sort/filter, per-track detail panel with manual overrides (BPM ×2/÷2, key, grid nudge) | Sonnet 4.6 | |
| 1.8 | Build a labeled test corpus manifest (20–30 royalty-free tracks with known BPM/key) + accuracy test suite; target ≥90% BPM within ±0.5 | Sonnet 4.6 | Agent should source CC0 audio (e.g., generate click/synth fixtures programmatically) rather than downloading copyrighted tracks |
| 1.9 | Unit tests for tag parsing, caching, worker harness | Haiku 4.5 | |

**Checkpoint:** import a folder, watch analysis complete, values correct on corpus.

---

## Phase 2 — Audio engine & timeline *(M2)*

| # | Task | Model | Notes |
|---|---|---|---|
| 2.1 | **AudioWorklet mixer graph design**: two deck chains (source → time-stretch → 3-band EQ → gain) → crossfader → master limiter; sample-accurate transport & scheduler; ADR-003 | **Opus 4.8** | Hardest module in the app |
| 2.2 | Integrate SoundTouch WASM time-stretch node; cap ±8% stretch (PRD risk table) | **Opus 4.8** | Real-time DSP in worklet context is fiddly |
| 2.3 | Timeline UI: two-lane arrangement, waveform rendering (canvas, virtualized), beat ticks, snapping, drag/trim clips | Sonnet 4.6 | |
| 2.4 | Manual transition editing v1: crossfade region with curve presets (linear/equal-power), audition from playhead | Sonnet 4.6 | |
| 2.5 | Undo/redo command system across store mutations | Sonnet 4.6 | |
| 2.6 | Engine unit tests (scheduler math, gain curves) + Playwright audition smoke test | Haiku 4.5 | Scaffolding from patterns; Sonnet if flaky |

**Checkpoint:** manually blend two tracks with beat-snapped crossfade and listen to it.

---

## Phase 3 — AI suggestions *(M3)*

| # | Task | Model | Notes |
|---|---|---|---|
| 3.1 | Deterministic blend scoring (`core/scoring`): Camelot adjacency, BPM delta incl. half/double, energy continuity; weighted composite with unit tests | Sonnet 4.6 | Pure functions |
| 3.2 | **Claude API client + prompt/schema design** for re-ranking and "why" blurbs; zod validation, timeout, retry-once, deterministic fallback; API key from settings | **Opus 4.8** | Prompt & schema quality determines feature quality; also security-sensitive (key handling) |
| 3.3 | Suggestions UI: ranked panel next to timeline, one-click append, "why" tooltip, offline-mode indicator | Sonnet 4.6 | |
| 3.4 | Local acceptance telemetry (did user take suggestion?) feeding score weights | Sonnet 4.6 | |
| 3.5 | Mocked-API integration tests + fallback-path tests (100% coverage on validators per NFR-6) | Haiku 4.5 | |

**Checkpoint:** with API key set, suggestions < 3 s with rationale; with no key, deterministic list still appears.

---

## Phase 4 — AI transition assistant *(M4)*

| # | Task | Model | Notes |
|---|---|---|---|
| 4.1 | Candidate mix-point detection: phrase boundaries from beatgrid (16/32-bar), intro/outro low-energy regions, feasibility scoring (required stretch %) | **Opus 4.8** | Algorithmic, builds on Phase 1 DSP |
| 4.2 | `TransitionSpec` automation schema finalization (fade curves, per-band EQ automation points, tempo ramp) + interpreter that applies a spec to the engine | **Opus 4.8** | Spec is the contract between AI and audio engine |
| 4.3 | LLM plan generation: prompt Claude (runtime: Sonnet 4.6) with pair analysis JSON → 1–3 labeled plans conforming to schema; validate; fallback to deterministic equal-power 16-bar blend | Sonnet 4.6 | Reuses 3.2 client |
| 4.4 | Transition editor v2: EQ automation lanes, bezier curve editing, plan picker ("32-bar blend", "cut on drop"), A/B audition | Sonnet 4.6 | Largest UI task; consider splitting |
| 4.5 | Tests: spec interpreter golden tests (spec → rendered gain/EQ envelopes) | Sonnet 4.6 | Golden-file DSP tests need care |

**Checkpoint:** select a pair → accept an AI plan → preview matches the described transition.

---

## Phase 5 — Export *(M5)*

| # | Task | Model | Notes |
|---|---|---|---|
| 5.1 | **Offline renderer**: replicate the exact mixer graph in OfflineAudioContext, chunked render with progress, deterministic output (NFR-5) | **Opus 4.8** | Parity with realtime engine is subtle |
| 5.2 | Loudness normalization (EBU R128 integrated measurement → gain; true-peak limit −1 dBTP) | **Opus 4.8** | Standards-correct DSP |
| 5.3 | Encoders: WAV writer, LAME MP3 WASM; AAC behind a documented flag | Sonnet 4.6 | |
| 5.4 | `.cue` sheet + timestamped tracklist generation; export UI with progress and cancel | Sonnet 4.6 | |
| 5.5 | Export tests: duration correctness, loudness within ±0.5 LU, structural guarantee no `StreamingTrackRef` reaches renderer | Haiku 4.5 | |

**Checkpoint:** 60-min project exports faster than realtime; artifacts correct.

---

## Phase 6 — Spotify integration *(M6)*

| # | Task | Model | Notes |
|---|---|---|---|
| 6.1 | OAuth 2.0 PKCE flow (scopes per PRD FR-6), token refresh, disconnect | Sonnet 4.6 | Security-relevant; agent must not log tokens |
| 6.2 | Playlist & saved-track import to `StreamingTrackRef` records; rate-limit handling | Sonnet 4.6 | |
| 6.3 | Track matcher: ISRC exact → normalized title/artist + duration ±2 s fuzzy; confidence tiers; manual match/unmatch UI | Sonnet 4.6 | |
| 6.4 | Metadata-only AI ordering for Spotify playlists (runtime: Haiku 4.5 batch annotation) + "streaming only" badging throughout UI | Sonnet 4.6 | |
| 6.5 | Tests with mocked Spotify API; matcher accuracy suite | Haiku 4.5 | |

**Checkpoint:** import playlist, ≥80% auto-match against local corpus, plan a set, mix the matched files.

---

## Phase 7 — Polish & docs *(M7)*

| # | Task | Model | Notes |
|---|---|---|---|
| 7.1 | Settings screen (API key, devices, quality presets, export defaults), autosave + versioned project schema migration | Sonnet 4.6 | |
| 7.2 | Error states, empty states, privacy note (PRD NFR-4), keyboard shortcuts | Sonnet 4.6 | |
| 7.3 | Full-pass bug hunt: run every user journey in Djium-PRD §4, fix findings | **Opus 4.8** | Cross-cutting reasoning pays off here |
| 7.4 | README, user guide, ADR index, CONTRIBUTING | Haiku 4.5 | |

---

## Standing instructions for the agent

1. **Never** send audio data to any LLM API — only structured metadata/analysis JSON (PRD NFR-4).
2. **Never** create a code path where Spotify audio can be buffered, processed, or exported (PRD FR-21 / §2). The type system enforces this; don't weaken it.
3. Every LLM response is untrusted input: validate with zod, fall back deterministically.
4. Write tests in the same PR as the feature; keep `core/dsp` and `core/scoring` free of DOM/engine imports.
5. Stop and ask the human at each phase checkpoint and for the open questions in Djium-PRD §11.
6. Do not download copyrighted music for test fixtures; generate synthetic audio or use CC0 sources.
