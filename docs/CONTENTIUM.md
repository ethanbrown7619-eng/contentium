# Contentium — Master Brief

**The ultimate content-creation suite: thirteen AI studios under one roof, all on Cloudflare.**

**Version:** 0.1 · **Status:** Foundation built, studios pending · **Date:** 2026-07-05

> This is the single source of truth for the whole project. It unifies thirteen
> individual product specs into one app, one platform, and one build plan. Read
> it fully before starting a work session. Per-studio source specs live in
> [`docs/studios/`](./studios); this brief supersedes them wherever they conflict
> on cross-cutting concerns (hosting, shared architecture, model IDs).

---

## 1. What Contentium is

Contentium is **one web app** that houses thirteen creative "studios," each a
focused content-creation tool. Together they cover the entire creator pipeline —
from the first idea to the published post and the analytics that decide what to
make next.

The thesis: creators currently stitch together a dozen disconnected tools.
Contentium makes them **one product** with a shared design language, a shared
asset library, a shared AI layer, and a shared account — so the output of one
studio flows directly into the next.

```
Idea ─▶ Write ─▶ Produce (audio / visuals / video) ─▶ Edit ─▶ Publish ─▶ Learn ─▶ (loop)
```

---

## 2. The thirteen studios

Grouped by pipeline stage (this is exactly how the hub renders them). The five
studios marked **(spec'd)** have full PRDs + plans in `docs/studios/`; the eight
marked **(new)** were added during unification and still need PRDs written
(their one-paragraph specs are in §11 and in the registry).

| Stage | Studio | Icon | One-liner | Source |
|---|---|---|---|---|
| **Write** | **Scriptium** | ✍️ | Ideas → scripts, captions, hooks; repurpose across platforms | new |
| **Audio** | **Beatium** | 🥁 | Describe a beat → editable multitrack pattern → WAV/MIDI | spec'd |
| **Audio** | **Songium** | 🎵 | Full song generation (structure, chords, melody, vocals) | new |
| **Audio** | **Djium** | 🎧 | AI DJ studio: what to play next, how to mix it, export the set | spec'd |
| **Audio** | **Podium** | 🎙️ | Podcast editor: strip filler/silence, chapters, AI show notes | new |
| **Audio** | **Voxium** | 🗣️ | AI voiceover / TTS from scripts | new |
| **Visuals** | **Thumbium** | 🖼️ | AI thumbnails & cover art with A/B variants | new |
| **Visuals** | **Imagium** | 🎨 | General image gen + edit (bg removal, inpaint, upscale) | new |
| **Video** | **Vidium** | 🎬 | CapCut-style in-browser multi-track editor (WebCodecs) | spec'd |
| **Video** | **Clipium** | ✂️ | Longform → auto-cut vertical captioned shorts | spec'd |
| **Video** | **Editium** | 🏆 | Raw sports clips → beat-synced viral edit | spec'd |
| **Publish & Grow** | **Postium** | 📤 | Format, schedule & cross-post every studio's output | new |
| **Publish & Grow** | **Datium** | 📊 | Cross-platform analytics + "what to make next" | new |

The canonical machine-readable registry is
[`packages/ui/src/apps.ts`](../packages/ui/src/apps.ts) — **add a studio there
and it appears across the hub, the nav rail, and its own landing page.**

---

## 3. Platform decision — everything on Cloudflare

The suite runs **entirely on Cloudflare** (this includes Beatium, whose source
PRD assumed Vercel + Supabase — that is remapped below). No AWS/GCP/Vercel/Supabase.

| Concern | Cloudflare primitive |
|---|---|
| SPA hosting | **Workers Assets** (static `apps/web` build; SPA fallback) |
| API | **Workers** (Hono) — `workers/api` |
| Relational data / job state | **D1** |
| Media, assets, exports | **R2** (private buckets, signed URLs) |
| Sessions / cache / rate limits | **KV** |
| Job orchestration | **Queues** |
| Heavy compute (ffmpeg, yt-dlp, whisper.cpp, OpenCV, librosa) | **Containers** (Durable Object–backed) |
| Per-job progress / coordination | **Durable Objects** |
| Transcription, image gen, TTS | **Workers AI** |
| Reasoning / structured generation | **Claude API** (server-side only) |
| Auth | **Cloudflare Access** for owner-gated tools; **Workers + KV sessions** (magic link + Google OAuth) for consumer accounts |
| Scheduled work (lease renew, pollers, watchdogs, scheduled posts) | **Cron Triggers** |
| Secrets | **Wrangler secrets / Secrets Store** — never in code, D1, or logs |

**Beatium remap (was Vercel + Supabase):** app → Workers Assets; Postgres →
**D1** (BeatDocument stored as JSON column); Supabase Auth → **Workers auth**
(magic link + Google OAuth, sessions in KV); Row-Level Security → enforced in
Worker query layer (owner-only, public-by-shareSlug).

**Requires the Cloudflare Workers Paid plan** (Queues + Containers). Confirm
before Clipium/Editium/Podium work — see §12 open questions.

---

## 4. Architecture

A **pnpm monorepo**. One React SPA hosts every studio as an internal module;
one Worker backs them; shared logic lives in `packages/`.

```
contentium/
├─ apps/
│  └─ web/                 # THE app: hub + all 13 studios as routes            [EXISTS]
├─ workers/
│  └─ api/                 # Hono Worker: AI proxy, jobs, sync, auth, webhooks  [TODO]
├─ containers/
│  ├─ media/               # yt-dlp + ffmpeg + whisper (Clipium, Podium)        [TODO]
│  └─ render/              # ffmpeg + OpenCV + librosa (Editium)                [TODO]
├─ packages/
│  ├─ ui/                  # design system + STUDIO REGISTRY                     [EXISTS]
│  ├─ shared/              # domain types + zod schemas (queue msgs, docs, EDL) [TODO]
│  ├─ ai/                  # Claude client: prompt builders, zod validate, retry[TODO]
│  ├─ audio-engine/        # Web Audio / Tone.js core (Beatium·Djium·Podium·Songium·Voxium) [TODO]
│  └─ video-engine/        # WebCodecs / WebGL2 core (Vidium; Clipium/Editium preview)      [TODO]
└─ docs/                   # this brief + per-studio PRDs & plans               [EXISTS]
```

**Non-negotiable boundaries (unified from all five source plans):**

1. **Engines never import React.** `packages/audio-engine` and
   `packages/video-engine` are pure TS + Workers, fully unit-testable. Enforce
   with an ESLint boundary rule.
2. **Every cross-boundary payload is zod-validated** in `packages/shared` —
   queue messages, API bodies, and *especially* Claude outputs. Never trust raw
   JSON.
3. **Runtime Claude/model IDs come from config/env**, never hardcoded in
   business logic (so a model can be upgraded without a code change).
4. **Raw media never goes to an LLM.** Only metadata, analysis summaries, and
   transcripts. (Djium NFR-4, Clipium, all audio/video studios.)
5. **Djium's Spotify constraint is structural:** streaming track refs have no
   audio pointer type, so Spotify audio is *unrepresentable* in the mix/export
   path — not merely checked. Don't weaken the type.
6. **Idempotency + artifacts-as-checkpoints** for all pipeline studios: check
   for the R2 artifact before recomputing a stage; a video ID / content hash is
   the idempotency key.
7. **Secrets server-side only.** Never log tokens, API keys, or transcript
   content — log IDs and token counts.

---

## 5. Tech stack (decided)

- **App:** React 19 + TypeScript (strict) + Vite 6, React Router 7, Tailwind
  CSS v4, Zustand + command-pattern undo (per-studio where needed).
- **Media:** WebCodecs + mp4box.js + mp4-muxer/webm-muxer + ffmpeg.wasm
  (fallback); Web Audio API + Tone.js; OPFS + IndexedDB for local storage.
- **Rendering:** WebGL2 compositor (Vidium), canvas timelines, AudioWorklet
  mixers (Djium/Beatium).
- **Edge:** Cloudflare Workers (Hono), R2, D1, KV, Queues, Containers, Durable
  Objects, Workers AI, Cron, Access.
- **AI:** Anthropic Claude API (server-side via `packages/ai` + `workers/api`);
  Workers AI for Whisper / image / TTS models.
- **Tooling:** pnpm workspaces, Vitest + Playwright, GitHub Actions + Wrangler.

---

## 6. Design system

The look is what makes thirteen tools feel like one product. Tokens live in
[`packages/ui/src/tokens.ts`](../packages/ui/src/tokens.ts); the web app maps
them into the Tailwind v4 `@theme` in `apps/web/src/index.css`.

- **Dark, near-black base** (`#0a0a0f`) with a subtle indigo→fuchsia ambient wash.
- **Umbrella brand:** indigo→fuchsia gradient (`#6366f1 → #d946ef`).
- **Per-studio accent:** every studio has a `base` color + a two-stop gradient
  (see the registry). Accents drive card glows, hero panels, nav highlights, and
  glyphs — applied via a `--accent` CSS variable, never hardcoded per component.
- **One shared shell:** a slim left rail (studios grouped by stage) + content
  area. Each studio's workspace renders inside the same shell.

When building a studio's real workspace, keep chrome in the shared shell and use
the studio's accent for its primary actions so the suite stays cohesive.

---

## 7. Current status — what's already built (Phase 0 ✅)

Running, typechecked, and building clean:

- ✅ pnpm monorepo (`apps/*`, `packages/*`, `workers/*` workspaces).
- ✅ `apps/web`: React 19 + Vite 6 + Tailwind v4, React Router.
- ✅ `packages/ui`: design tokens + the 13-studio registry (source-resolved via
  Vite alias — no build step).
- ✅ The **Contentium hub** (launcher): hero + studios grouped by the five stages.
- ✅ A **generic, registry-driven studio landing page** for all 13 (hero, "what
  it does", "under the hood", workspace placeholder, prev/next nav).
- ✅ Shared **app shell** with a stage-grouped nav rail.
- ✅ Cloudflare **Workers Assets** deploy config (`apps/web/wrangler.jsonc`).
- ✅ `build` + `typecheck` green.

**Run it:**

```bash
pnpm install
pnpm dev          # Vite dev server (http://localhost:5173)
pnpm build        # production build → apps/web/dist
pnpm typecheck    # tsc --noEmit across the workspace
# deploy (after `wrangler login`):
pnpm --filter @contentium/web deploy
```

What is **not** built yet: every studio's actual workspace, the `workers/api`
backend, the shared `ai` / `shared` / engine packages, auth, D1 schema, CI.

---

## 8. Build roadmap (suite-level)

Phases gate on the one before. Each studio task keeps tests in the same change.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Foundation** ✅ | Monorepo, hub, design system, registry, studio landings, deploy config | `pnpm dev`/`build`/`typecheck` green (done) |
| **1 — Shared infra** | `workers/api` (Hono) skeleton + bindings; `packages/shared` (zod schemas); `packages/ai` (Claude client: prompt builders, validation, retry, fallback); auth (KV sessions + magic link/OAuth); D1 baseline; GitHub Actions CI (typecheck/lint/test/`wrangler deploy --dry-run`) | An authenticated Worker route calls Claude through the shared client, validated + logged; CI green |
| **2 — First vertical (Scriptium)** | Cheapest full end-to-end studio: prompt → Claude → validated output → UI. Proves the whole stack | A user writes a script + captions end-to-end in the deployed app |
| **3 — Audio engine + Beatium** | `packages/audio-engine` (Tone.js transport, scheduling, offline export) + Beatium (text→BeatDocument, sequencer, piano roll, mixer, WAV/MIDI) | Generate, edit, and export a beat in-browser |
| **4 — Video engine + Vidium** | `packages/video-engine` (WebCodecs decode/encode, WebGL2 compositor, timeline) + Vidium editor + export | Import → edit → export a 1080p MP4 in-browser |
| **5 — Cloudflare pipelines** | Containers + Queues + D1 state machines for Clipium & Editium (+ Podium) | Upload/URL → job → rendered vertical clip, retries survive container kill |
| **6 — Audio family** | Djium, Podium, Songium, Voxium on the shared audio engine | Each usable end-to-end |
| **7 — Visuals** | Thumbium, Imagium on Workers AI image models + R2 asset store | Generate + edit + save images |
| **8 — Publish & Grow** | Postium (format/schedule/cross-post) + Datium (analytics/trends) — consume every studio's output | Schedule a cross-post; see performance feed ideas back to Scriptium |

**Recommended build order & rationale**

1. **Shared infra first** — everything AI depends on `workers/api` + `packages/ai`.
2. **Scriptium** — fastest full slice; low risk; proves the stack; feeds every
   other studio's copy.
3. **Beatium** then **Vidium** — the two hardest client engines; every other
   audio/video studio reuses them, so build the engines behind a flagship.
4. **Clipium/Editium/Podium** — Cloudflare pipeline studios; share Containers +
   Whisper + render code.
5. **Djium/Songium/Voxium**, then **Thumbium/Imagium**, then **Postium/Datium**
   (glue last — they consume the others).

---

## 9. Model strategy

> **Two different things — don't conflate them.** "Build-time model" = which
> Claude model *you (the coding agent) run as* in the CLI. "Runtime model" =
> which model *the shipped app calls* at inference time.

### 9.1 Current model IDs (verify before pinning)

The source specs were written against **Sonnet 4.6**, which is now superseded by
**Sonnet 5**. Use current IDs:

| Tier | ID | Notes |
|---|---|---|
| Most capable | `claude-fable-5` | Hardest architecture/algorithm/security tasks |
| High | `claude-opus-4-8` | Architecture, engines, tricky concurrency; Fable alternative |
| Workhorse | `claude-sonnet-5` | **Use wherever the source docs say `claude-sonnet-4-6`** |
| Fast/cheap | `claude-haiku-4-5-20251001` | High-volume, low-complexity generation |

Always re-verify IDs, capabilities, and pricing at
<https://docs.claude.com/en/api/overview> (or via the `claude-api` skill) before
committing to them in code or cost models.

### 9.2 Build-time (the CLI agent)

- **Fable 5 / Opus 4.8** — architecture decisions; the audio & video engines;
  DSP (BPM/key/beatgrid); export/offline renderers; EDL → ffmpeg
  `filter_complex` compilers; CV auto-reframe; prompt + schema design; security
  reviews. Anything where a subtle early bug is expensive.
- **Sonnet 5** — the default: UI, panels, state wiring, API routes,
  integrations, most tests and debugging.
- **Haiku 4.5** — boilerplate, config, scaffolding, docs, simple fixes.

*(You're using Fable as the advisor — perfect for the Phase 1 infra design and
each engine's architecture pass. Drop to Sonnet for the implementation bulk.)*

### 9.3 Runtime (what each studio calls)

| Studio | Runtime models |
|---|---|
| Scriptium | `claude-sonnet-5` (drafting) · `claude-haiku-4-5` (rewrites) |
| Beatium | `claude-sonnet-5` (beat gen) · `claude-haiku-4-5` (conversational edits) · `claude-opus-4-8`/`claude-fable-5` (pro tier) |
| Songium | `claude-sonnet-5` (arrangement/lyrics) + a music-gen model (audio) |
| Djium | `claude-sonnet-5` (suggestions/transitions) · `claude-haiku-4-5` (annotations) · `claude-opus-4-8`/`claude-fable-5` (deep set plan) |
| Podium | Workers AI Whisper + `claude-sonnet-5`/`claude-haiku-4-5` (chapters/notes) |
| Voxium | Workers AI TTS + `claude-haiku-4-5` (SSML/phrasing) |
| Thumbium / Imagium | Workers AI image models + `claude-haiku-4-5`/`claude-sonnet-5` (layout/prompt) |
| Vidium | none at runtime (v1) |
| Clipium | Workers AI Whisper + `claude-sonnet-5` (moment selection) · `claude-haiku-4-5` (copy) |
| Editium | `claude-haiku-4-5` (hook text / segment ranking) |
| Postium | `claude-haiku-4-5`/`claude-sonnet-5` (captions, best-time) |
| Datium | `claude-sonnet-5` (trend synthesis / ideas) |

All runtime Claude calls: strict JSON output contract, zod validation, one
repair retry, deterministic fallback, token budget + rate limits, cost logged.

---

## 10. Standing instructions for the agent (unified)

1. Read this brief before each session; read the relevant studio's PRD/plan in
   `docs/studios/` before working on one of the five spec'd studios.
2. Keep engines (`audio-engine`, `video-engine`) free of DOM/React/engine-UI
   imports; keep `core/dsp` and `core/scoring`–style modules pure and tested.
3. Every LLM response is untrusted: zod-validate, repair once, fall back
   deterministically. 100% coverage on validators.
4. Never send raw audio/video to an LLM; never log secrets or transcript text.
5. Runtime model IDs live in config/env; never hardcode them in logic.
6. Pipeline stages are idempotent; check for the R2 artifact before recomputing.
7. Write tests in the same change as the feature; commit in small revertible
   steps with a one-line decision summary.
8. Don't download copyrighted media for fixtures — generate synthetic audio/video
   or use CC0.
9. When a plan turns out wrong (a library limitation, a Cloudflare constraint),
   stop and write a short ADR under `docs/adr/` (use Fable/Opus) before proceeding.
10. Verify Cloudflare product specifics against current docs — Containers,
    Queues, and Workers AI change quickly.
11. Add a studio only through `packages/ui/src/apps.ts`; flip its `status`
    (`planned` → `beta` → `live`) as it's built.

---

## 11. Quick specs for the eight new studios

These need full PRDs (a good early Fable task — mirror the structure of the
existing `docs/studios/*/PRD.md`). One-paragraph scope each; more in the registry.

- **Scriptium** — Prompt/idea → outline → full script; then hooks, titles,
  captions, hashtags, and per-platform rewrites (TikTok/Shorts/Reels/X);
  teleprompter mode. Workers + Claude, no heavy compute. The glue that feeds
  other studios (Voxium, Postium).
- **Songium** — Full-track generation: song structure, chord progressions,
  melody, arrangement, optional generated vocals. Claude designs
  structure/lyrics; a music-gen model synthesizes audio behind a clean
  interface. Hands stems to Beatium/Vidium.
- **Podium** — Podcast/long-audio editor: Whisper transcript → edit audio by
  editing text; auto-remove filler + long silences; auto chapters; AI show notes
  & titles; multitrack leveling. Reuses audio-engine + Containers (ffmpeg).
- **Voxium** — Script → clean narration; multiple voices, pace/emphasis,
  pronunciation dictionary. Workers AI TTS (or provider) behind an interface;
  one-click hand-off into video studios.
- **Thumbium** — Thumbnail & cover-art studio: AI backgrounds + subject cutout +
  bold text + A/B variant batches, sized per platform; cover art for
  Beatium/Songium. Workers AI image models + canvas + R2.
- **Imagium** — General image gen/edit: text-to-image, background removal,
  inpaint/outpaint, upscale/restore; shared asset library. Broader canvas behind
  Thumbium.
- **Postium** — Publish hub: pull any studio's export → auto-format per platform
  → schedule + cross-post from one calendar (Shorts/TikTok/Reels/X). Workers +
  D1 + Cron + platform APIs; captions/hashtags synced from Scriptium.
- **Datium** — Analytics + trend finder: cross-platform performance in one view;
  trend/topic discovery; AI "make this next" suggestions fed back into
  Scriptium. Closes the create→publish→learn loop.

---

## 12. Open questions / decisions for the human

Consolidated from all five source PRDs plus the unification:

- **Cloudflare account:** Workers **Paid** plan enabled (needed for Queues +
  Containers)? Which account/zone for prod vs preview?
- **Anthropic API key:** provisioning + budget; per-user daily generation caps.
- **Accounts model:** one Contentium sign-in across all studios (recommended)?
  Anonymous/local-only mode for the client studios (Vidium/Beatium) like the
  source PRDs assume?
- **Shared asset library** across studios (R2 + D1), or per-studio storage?
- **Djium:** is a Spotify developer app (client ID) registered? Browser-only or
  Electron-ready from day one?
- **Clipium:** YouTube Data API key? Cloudflare Access for the single-owner
  dashboard?
- **Vidium:** Safari day-one, or Chromium-first with a compatibility banner?
- **Beatium:** confirm CC0-only sample kits (licensing/provenance in CI).
- **Scope for "v1":** which studios ship first vs. later? (Roadmap §8 proposes an
  order; confirm or reprioritize.)
- **The eight new studios need PRDs** — have Fable draft them next?

---

## 13. Repo map

```
docs/
  CONTENTIUM.md          ← this brief (start here)
  studios/
    djium/{PRD,PLAN}.md   ← original spec'd studios
    clipium/{PRD,PLAN}.md
    vidium/{PRD,PLAN}.md
    editium/{PRD,PLAN}.md
    beatium/{PRD,PLAN}.md
apps/web/                 ← the single React SPA (hub + studios)
packages/ui/              ← design tokens + STUDIO REGISTRY (apps.ts)
packages/…                ← shared, ai, audio-engine, video-engine (to build)
workers/api/              ← Hono Worker backend (to build)
containers/               ← ffmpeg/whisper/opencv jobs (to build)
```

**To continue:** start Phase 1 (shared infra). Design the `workers/api` +
`packages/ai` + `packages/shared` contracts with Fable, then implement with
Sonnet. Keep the registry (`packages/ui/src/apps.ts`) as the source of truth for
what exists.
