# PRD — Beatium: AI-Powered Beat Making Web App

**Version:** 1.0 · **Status:** Draft for build · **Owner:** [You] · **Date:** July 2026

---

## 1. Overview

Beatium is a browser-based beat-making studio where users describe the beat they want in natural language ("dark 140bpm UK drill with sparse hats") and an AI generates a fully editable multitrack pattern. Users then refine it in a DAW-lite environment: step sequencer, piano roll, mixer, effects, and export to WAV/MIDI.

### Core thesis
AI should generate **structured, editable musical data** (patterns, not rendered audio). This keeps generation fast and cheap, makes every AI output fully editable by the user, and keeps audio quality deterministic via a high-quality in-browser synthesis/sampling engine. Audio-generation models (for custom one-shot samples) are a Phase 2 bolt-on behind a clean interface.

### Target users
- Bedroom producers and hobbyists who want fast idea generation
- Content creators needing quick royalty-free beats
- Beginners who want to learn beat structure by editing AI output

---

## 2. Goals & Non-Goals

### Goals (v1)
1. Text-to-beat: prompt → complete multitrack pattern in < 10 seconds
2. Full pattern editing: step sequencer (drums) + piano roll (melodic tracks)
3. DAW-lite mixing: per-track volume, pan, mute/solo, and insert effects
4. Effects: reverb, delay, filter, compressor, distortion, EQ (per track + master bus)
5. Export: WAV (offline render), MIDI, and shareable project links
6. Accounts, project save/load, versioned autosave
7. AI iteration: "make the hats busier", "swap to a trap feel" — conversational edits to the current pattern

### Non-Goals (v1)
- Audio recording / mic input
- Sample upload marketplace
- Full song arrangement beyond pattern chaining (max 8 chained patterns)
- Mobile-native apps (responsive web only; desktop-first)
- Realtime multi-user collaboration
- AI-generated audio samples (Phase 2)

---

## 3. User Stories

| # | Story | Priority |
|---|-------|----------|
| U1 | As a user, I type a description and get a playable beat with drums, bass, and melody tracks | P0 |
| U2 | As a user, I toggle steps in a 16/32-step drum grid and hear changes instantly | P0 |
| U3 | As a user, I edit melodic notes in a piano roll (pitch, length, velocity) | P0 |
| U4 | As a user, I adjust BPM, swing, and pattern length | P0 |
| U5 | As a user, I mix tracks (volume/pan/mute/solo) and add effects | P0 |
| U6 | As a user, I ask the AI to modify the current beat conversationally | P0 |
| U7 | As a user, I export my beat as a WAV or MIDI file | P0 |
| U8 | As a user, I sign up, save projects, and reopen them later | P0 |
| U9 | As a user, I share a read-only link; visitors can play and remix into their own copy | P1 |
| U10 | As a user, I chain patterns into a simple A/B/A/C arrangement | P1 |
| U11 | As a user, I choose from sound kits (808, acoustic, lo-fi, synthwave...) per track | P1 |
| U12 | As a user, I undo/redo any edit including AI edits | P0 |

---

## 4. Functional Requirements

### 4.1 AI Beat Generation
- Input: free-text prompt + optional constraints (BPM, key, genre, bar count)
- Output: a validated **BeatDocument** (JSON schema) containing tracks, patterns, kit assignments, mixer settings, and suggested BPM/key
- Model calls go through a server-side generation service (API keys never touch the client)
- Every generation is schema-validated and auto-repaired (one retry with error feedback) before reaching the client
- Conversational edits: the current BeatDocument + user instruction → a diff or full replacement document; edits land as undoable transactions
- Guardrails: max token budget per request, rate limiting per user, prompt-injection-safe system prompt

### 4.2 Sequencer & Playback Engine
- Web Audio API via **Tone.js** (Transport, lookahead scheduling)
- 16/32/64 steps per pattern, 1–8 bars, swing 0–100%, BPM 40–240
- Track types: **drum** (sample-based, step grid) and **melodic** (synth or sampler, piano roll)
- Sample kits stored as static assets (curated CC0/licensed one-shots); synth presets defined in code (Tone.js synth configs)
- Latency-safe scheduling: pattern edits during playback take effect at the next step boundary without glitches
- Playback position indicator synced to audio clock, not requestAnimationFrame guesses

### 4.3 Mixer & Effects
- Per track: gain, pan, mute, solo, up to 3 insert effects
- Master bus: limiter (always on) + up to 3 effects
- Effects: reverb, ping-pong delay, LP/HP filter, compressor, distortion, 3-band EQ
- All parameters automatable in v1.5 (out of v1 scope, but data model must reserve space)

### 4.4 Export
- **WAV:** offline render via `Tone.Offline` / OfflineAudioContext, 44.1kHz 16-bit stereo, includes full effects chain
- **MIDI:** per-track MIDI export (drums mapped to GM drum notes) using `@tonejs/midi`
- Export runs client-side; no server render farm needed for v1

### 4.5 Projects & Accounts
- Auth: email magic link + Google OAuth
- Projects: BeatDocument stored as JSONB; autosave every 15s of idle after change; last 20 versions retained
- Share links: unguessable slug, read-only player view, "Remix" clones into visitor's account

### 4.6 Data Model (core entities)
```
User { id, email, displayName, createdAt }
Project { id, ownerId, title, bpm, key, beatDocument: JSONB, isPublic, shareSlug, createdAt, updatedAt }
ProjectVersion { id, projectId, beatDocument, createdAt }
GenerationLog { id, userId, projectId, prompt, model, tokensIn, tokensOut, latencyMs, createdAt }
```

### 4.7 BeatDocument schema (summary)
```
BeatDocument {
  bpm, swing, key, bars, stepsPerBar,
  tracks: [{
    id, name, type: "drum" | "melodic",
    kit | instrument, 
    steps?: [{ index, velocity }],            // drum
    notes?: [{ pitch, start, duration, vel }], // melodic
    mixer: { gain, pan, mute, solo },
    effects: [{ type, params }]
  }],
  masterEffects: [...],
  arrangement: [patternRefs]   // P1
}
```
This schema is the contract between the AI service, the editor UI, and the audio engine. It gets a formal JSON Schema + Zod validator and is versioned (`schemaVersion` field) from day one.

---

## 5. Non-Functional Requirements

- **Performance:** time-to-first-sound < 3s on load; AI generation p50 < 8s; audio scheduling jitter < 5ms; UI stays 60fps during playback
- **Browser support:** latest Chrome, Edge, Firefox, Safari 17+ (AudioWorklet + OfflineAudioContext required)
- **Cost control:** per-user daily generation cap (e.g. 50 free generations), token budgets enforced server-side
- **Security:** API keys server-side only; RLS on all project data; share slugs ≥ 128 bits entropy
- **Accessibility:** keyboard-operable sequencer grid, ARIA labels, respects prefers-reduced-motion

---

## 6. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + TypeScript + Vite | Ecosystem, fast HMR |
| State | Zustand + Immer (undo/redo middleware) | Simple, transaction-friendly |
| Audio | Tone.js (+ raw Web Audio where needed) | Transport, scheduling, offline render |
| Styling | Tailwind CSS | Speed |
| Backend | Node (Fastify) or Next.js API routes | Single-language stack |
| DB/Auth | Supabase (Postgres + Auth + RLS) | Auth, JSONB, RLS out of the box |
| AI | Anthropic API (Claude models, server-side) | Structured generation quality |
| Hosting | Vercel (app) + Supabase (data) | Zero-ops v1 |

---

## 7. Phase 2 (explicitly out of v1)

- AI audio-sample generation (one-shots via a music-gen model) behind the existing kit interface
- Parameter automation lanes
- Community feed of public beats
- Stem export (per-track WAV)
- Realtime collab

---

## 8. Success Metrics

- Activation: ≥ 60% of new signups play a generated beat within first session
- Editing depth: ≥ 40% of generated beats receive ≥ 5 manual edits
- Export rate: ≥ 15% of projects exported
- Generation quality: ≤ 5% schema-repair failures; user "regenerate" rate < 35%

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI outputs musically weak patterns | Heavy prompt engineering with genre exemplars; few-shot library; eval harness with human rating loop |
| Safari audio quirks | Early Safari spike in Phase 1; feature-detect and degrade |
| Schema drift breaks old projects | `schemaVersion` + migration functions from day one |
| Generation cost blowout | Caps, cheap model for edits, caching of kit/genre exemplars via prompt caching |
| Sample licensing | Only CC0/owned kits; provenance manifest checked in CI |
