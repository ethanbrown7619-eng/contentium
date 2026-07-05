# Contentium

**The ultimate content-creation suite — thirteen AI studios under one roof, all on Cloudflare.**

From the first idea to the published post: write it, produce it (audio, visuals,
video), edit it, publish it, and learn what to make next — without leaving the app.

```
Write ─▶ Audio · Visuals · Video ─▶ Publish & Grow
```

| Stage | Studios |
|---|---|
| ✍️ **Write** | Scriptium |
| 🔊 **Audio** | Beatium · Songium · Djium · Podium · Voxium |
| 🖼️ **Visuals** | Thumbium · Imagium |
| 🎬 **Video** | Vidium · Clipium · Editium |
| 📤 **Publish & Grow** | Postium · Datium |

## Start here

📖 **[docs/CONTENTIUM.md](./docs/CONTENTIUM.md)** — the master brief: vision, the
full roster, the Cloudflare architecture, what's already built, the roadmap, and
the model strategy. Read it before working on the project.

Per-studio source specs: [`docs/studios/`](./docs/studios).

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build → apps/web/dist
pnpm typecheck
```

## Stack

React 19 · TypeScript · Vite 6 · Tailwind v4 · React Router 7 — deployed on
Cloudflare (Workers Assets, Workers/Hono, R2, D1, KV, Queues, Containers,
Durable Objects, Workers AI) with Claude for the reasoning layer.

## Layout

```
apps/web/          the single SPA: hub + all 13 studios
packages/ui/       design system + the studio registry (apps.ts)
packages/…         shared, ai, audio-engine, video-engine (to build)
workers/api/       Hono Worker backend (to build)
containers/        ffmpeg / whisper / opencv jobs (to build)
docs/              master brief + per-studio specs
```

Studios are registered in **`packages/ui/src/apps.ts`** — the single source of
truth for what exists. Add one there and it appears across the hub, the nav, and
its own page.
