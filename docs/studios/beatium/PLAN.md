# PLAN.md — Beatium Build Plan for Claude Code

This plan is written to be executed by Claude Code. Each task specifies **which Claude model to run it with**. Switch models per task with `/model` in Claude Code (or set per-session). Read `PRD.md` in full before starting any task.

## Model assignment strategy

| Model | Model string | Use for |
|-------|-------------|---------|
| **Claude Opus 4.8** | `claude-opus-4-8` | Architecture, the audio engine, scheduling, offline export, AI prompt/eval design, undo/redo transaction system — anything where a subtle bug is expensive |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | The workhorse: UI components, API routes, auth, CRUD, state stores, most feature work |
| **Claude Haiku 4.5** | `claude-haiku-4-5` | Scaffolding, config, boilerplate, static assets wiring, simple styling passes, README/docs |

Rules of thumb for the agent:
- If a task touches the Web Audio clock, the BeatDocument schema, or undo/redo semantics → Opus.
- If a task is "build a component/route/store to a clear spec" → Sonnet.
- If a task is mechanical (rename, config, copy assets, write docs) → Haiku.
- Runtime AI calls inside the app also use different models (see Task 4.2) — don't confuse build-time agent models with runtime API models.

---

## Phase 0 — Foundations (Day 1)

### Task 0.1 — Repo scaffold · **Haiku 4.5**
Vite + React + TS + Tailwind + ESLint/Prettier + Vitest. Folder layout:
```
/src
  /audio      # engine, scheduling, effects, export
  /ai         # client for generation service
  /components # UI
  /state      # zustand stores
  /schema     # BeatDocument schema + zod + migrations
  /pages
/server       # Fastify: /generate, /edit endpoints
/supabase     # migrations, RLS policies
/assets/kits  # sample kits + manifest
```
**Done when:** `pnpm dev` runs, `pnpm test` runs, CI lints and tests on push.

### Task 0.2 — BeatDocument schema · **Opus 4.8**
Implement the schema from PRD §4.7 as TypeScript types + Zod validators + JSON Schema export. Include `schemaVersion`, a `migrate(doc)` framework, and exhaustive unit tests including malformed-input repair cases. This is the contract everything else depends on — get it right first.
**Done when:** round-trip validate/serialize tests pass; invalid docs produce actionable error messages (needed for AI auto-repair in 4.1).

### Task 0.3 — Supabase setup · **Sonnet 4.6**
Tables from PRD §4.6, RLS policies (owner-only read/write; public read via shareSlug), auth (magic link + Google). Seed script with a demo project.
**Done when:** RLS tested with two users; auth flow works locally.

---

## Phase 1 — Audio Engine (Days 2–5) — the hard core

### Task 1.1 — Playback engine spike · **Opus 4.8**
Tone.js Transport wrapper: load a hardcoded BeatDocument, schedule drum steps + melodic notes with lookahead scheduling, BPM/swing changes live, edit-during-playback applied at step boundaries without glitches. Include a Safari smoke test checklist.
**Done when:** a hardcoded 4-track beat loops glitch-free; toggling steps mid-playback is seamless; position indicator is driven by `Transport.scheduleRepeat`, not rAF.

### Task 1.2 — Kit & instrument layer · **Sonnet 4.6**
Sample loader (preload + decode kits from `/assets/kits` manifest), Tone.js synth preset registry for melodic tracks (sub bass, pluck, keys, lead, pad). Kit-swap without stopping playback.
**Done when:** all kits load < 1.5s on broadband; swapping kit on a playing track works.

### Task 1.3 — Mixer & effects graph · **Opus 4.8**
Per-track channel strips (gain/pan/mute/solo) → insert effect chains → master bus with always-on limiter. Effects: reverb, ping-pong delay, LP/HP filter, compressor, distortion, 3-band EQ. Effect add/remove/reorder without clicks (ramped connect/disconnect).
**Done when:** solo/mute logic correct with multiple solos; no audible clicks on any parameter or graph change; CPU stays sane with 8 tracks × 3 effects.

### Task 1.4 — WAV & MIDI export · **Opus 4.8**
Offline render via `Tone.Offline` reconstructing the full graph (this is the classic pitfall — the live graph can't be reused). 44.1kHz 16-bit stereo WAV encode + download. MIDI export via `@tonejs/midi`, GM drum mapping.
**Done when:** exported WAV is sample-accurate vs. live playback (spot-check waveform), includes all effects; MIDI opens correctly in a DAW.

### Task 1.5 — Engine ↔ state binding · **Opus 4.8**
Zustand store holding the BeatDocument with Immer transactions and undo/redo middleware (patches-based). Engine subscribes to store diffs and applies minimal audio-graph updates. AI edits (later) commit as single undoable transactions.
**Done when:** 100-step undo/redo stress test passes; no full engine rebuilds on small edits.

---

## Phase 2 — Editor UI (Days 5–9)

### Task 2.1 — App shell & transport bar · **Haiku 4.5**
Layout, play/stop, BPM/swing/bars controls, project title. Keyboard: space = play/stop, cmd-z/shift-cmd-z.

### Task 2.2 — Step sequencer grid · **Sonnet 4.6**
16/32/64-step drum grid, velocity via drag or right-click, playhead highlight, per-row kit piece labels, drag-paint steps. Keyboard-operable per PRD accessibility notes.
**Done when:** 60fps during playback with 8 drum rows; grid virtualizes at 64 steps.

### Task 2.3 — Piano roll · **Sonnet 4.6** (escalate to **Opus 4.8** if interaction math gets hairy)
Note create/move/resize/delete, velocity lane, snap-to-grid, key highlighting from project key, zoom. This is the most complex UI surface — spec interactions in a short design doc first and get it reviewed in the same session before coding.
**Done when:** all note operations undoable; no drift between visual grid and audio timing.

### Task 2.4 — Mixer panel & effects UI · **Sonnet 4.6**
Channel strips, effect slot UI with per-effect parameter panels, master strip.

### Task 2.5 — Visual polish pass · **Haiku 4.5**
Consistent dark theme, spacing, empty states, loading states, responsive breakpoints (desktop-first).

---

## Phase 3 — Projects, Auth, Sharing (Days 9–11)

### Task 3.1 — Auth UI + session handling · **Sonnet 4.6**
### Task 3.2 — Project CRUD, autosave (15s idle), version history (keep 20) · **Sonnet 4.6**
### Task 3.3 — Share links + read-only player + Remix flow · **Sonnet 4.6**
**Done when:** two-account test: share → visit → remix → edit copy; original untouched.

---

## Phase 4 — AI Generation (Days 11–15)

### Task 4.1 — Generation service (server) · **Opus 4.8**
Fastify endpoints `/generate` and `/edit`. Server-side Anthropic API calls, schema validation with one auto-repair retry (feed Zod errors back to the model), rate limiting, GenerationLog writes, prompt caching for the static system prompt + kit/genre exemplars.
**Done when:** malformed model output is repaired or fails gracefully; keys never reach client; p50 latency logged.

### Task 4.2 — Prompt engineering + runtime model routing · **Opus 4.8**
Design the system prompt: BeatDocument JSON Schema, genre exemplar library (8–10 hand-crafted exemplar beats across trap, drill, house, lo-fi, boom bap, DnB, synthwave, afrobeats), music-theory guidance (key-consistent basslines, velocity humanization, swing conventions).

**Runtime model routing (inside the app, not the coding agent):**
- Full beat generation from prompt → `claude-sonnet-4-6` (best quality/latency/cost balance for structured JSON generation)
- Conversational small edits ("busier hats") → `claude-haiku-4-5` with the current doc + diff-style output (fast, cheap)
- Optional "Pro generate" tier later → `claude-opus-4-8`

**Done when:** 20-prompt eval set produces valid, playable, genre-plausible beats ≥ 90% first-try.

### Task 4.3 — Eval harness · **Opus 4.8**
Script that runs the prompt set, validates schemas, computes heuristics (note density, key conformity, velocity variance) and renders WAVs for human listening review. Re-run after any prompt change.

### Task 4.4 — Generation UI · **Sonnet 4.6**
Prompt bar, generation progress states, "AI edit" chat drawer, regenerate, and AI-edit-as-undoable-transaction wiring into the store from Task 1.5.

---

## Phase 5 — Ship (Days 15–17)

### Task 5.1 — Pattern chaining (A/B/A/C arrangement) · **Sonnet 4.6** (P1 — cut first if behind)
### Task 5.2 — Cross-browser QA, Safari fixes, perf profiling · **Opus 4.8**
### Task 5.3 — Deploy (Vercel + Supabase prod), env/config, generation caps · **Sonnet 4.6**
### Task 5.4 — README, user-facing help page, kit license manifest · **Haiku 4.5**

---

## Standing instructions for the Claude Code agent

1. Read PRD.md and this file before every phase; re-read the BeatDocument schema before any task that touches it.
2. Never edit `/src/schema` without also writing a migration and bumping `schemaVersion`.
3. Every task ends with: tests written/passing, `pnpm lint` clean, a short commit-message-style summary of decisions made.
4. If a task reveals the plan is wrong (e.g., Tone.js limitation), stop and write a brief ADR (`/docs/adr/NNN-*.md`) before proceeding — use Opus for ADRs.
5. Audio bugs: reproduce with a minimal script in `/scripts/repro/` before fixing.
6. Do not upgrade major dependencies mid-build.
7. Anthropic API usage in the app must follow current docs — verify endpoints/params at https://docs.claude.com/en/api/overview rather than relying on memory.
