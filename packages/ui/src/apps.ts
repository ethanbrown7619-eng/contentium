/**
 * The Contentium studio registry.
 *
 * This is the single source of truth for which studios exist, what they do,
 * and how they look. The hub, the global nav, and each studio's landing page
 * all render from this list — add an entry here and the app appears everywhere.
 */

export type StudioStage =
  | "Write"
  | "Audio"
  | "Visuals"
  | "Video"
  | "Publish & Grow";

export type StudioStatus =
  /** fully usable */
  | "live"
  /** partially built, usable with rough edges */
  | "beta"
  /** landing page only, implementation pending */
  | "planned";

export interface StudioMeta {
  /** url + registry key, e.g. "beatium" */
  id: string;
  /** display name, e.g. "Beatium" */
  name: string;
  /** emoji glyph used until we design real marks */
  icon: string;
  /** one punchy line */
  tagline: string;
  /** a sentence or two of what it does */
  blurb: string;
  /** pipeline stage grouping in the hub */
  stage: StudioStage;
  status: StudioStatus;
  /** accent color system */
  accent: {
    base: string;
    soft: string;
    gradient: [string, string];
  };
  /** headline capabilities shown on the studio landing page */
  highlights: string[];
  /** where the heavy lifting runs */
  runtime: string;
  /** what Claude does here (empty string if no AI at runtime) */
  ai: string;
}

export const STUDIOS: StudioMeta[] = [
  // ── Write ────────────────────────────────────────────────────────────────
  {
    id: "scriptium",
    name: "Scriptium",
    icon: "✍️",
    tagline: "Ideas to scripts, captions, and hooks.",
    blurb:
      "Your writing copilot. Turn a rough idea into a full script, then spin hooks, captions, hashtags, and platform-specific rewrites. The connective tissue that feeds every other studio.",
    stage: "Write",
    status: "planned",
    accent: { base: "#38bdf8", soft: "rgba(56,189,248,0.12)", gradient: ["#38bdf8", "#2563eb"] },
    highlights: [
      "Idea → outline → full script",
      "Hooks, titles, captions, hashtags",
      "Repurpose one script across TikTok, Shorts, Reels, X",
      "Teleprompter mode",
    ],
    runtime: "Workers (Hono) + Claude API",
    ai: "Drafting and repurposing with claude-sonnet-5; fast rewrites with claude-haiku-4-5",
  },

  // ── Audio ────────────────────────────────────────────────────────────────
  {
    id: "beatium",
    name: "Beatium",
    icon: "🥁",
    tagline: "Describe it. Hear it. Edit it.",
    blurb:
      "AI beat-making studio. Describe a beat in plain language and get a fully editable multitrack pattern — step sequencer, piano roll, mixer, effects — then export to WAV or MIDI.",
    stage: "Audio",
    status: "planned",
    accent: { base: "#a3e635", soft: "rgba(163,230,53,0.12)", gradient: ["#a3e635", "#22c55e"] },
    highlights: [
      "Text → editable BeatDocument in seconds",
      "Step sequencer + piano roll + mixer",
      "Conversational edits (\"busier hats\", \"trap feel\")",
      "WAV + MIDI export, all in-browser",
    ],
    runtime: "Browser (Tone.js / Web Audio) + Workers AI proxy",
    ai: "Structured beat generation with claude-sonnet-5; conversational edits with claude-haiku-4-5",
  },
  {
    id: "songium",
    name: "Songium",
    icon: "🎵",
    tagline: "Full tracks, vocals and all.",
    blurb:
      "Complete song generation — where Beatium makes the beat, Songium builds the whole record: structure, chords, melody, and vocal lines, arranged into a finished track.",
    stage: "Audio",
    status: "planned",
    accent: { base: "#34d399", soft: "rgba(52,211,153,0.12)", gradient: ["#34d399", "#059669"] },
    highlights: [
      "Prompt → full song structure (intro/verse/chorus)",
      "Chord progressions + melody + arrangement",
      "Optional generated vocals",
      "Hand off stems to Beatium or Vidium",
    ],
    runtime: "Browser engine + Workers AI / music-gen provider",
    ai: "Arrangement and lyric structure via Claude; audio synthesis via a music-gen model behind a clean interface",
  },
  {
    id: "djium",
    name: "Djium",
    icon: "🎧",
    tagline: "Your next track, mixed for you.",
    blurb:
      "AI-assisted DJ studio. Drop in your tracks and Djium tells you what to play next, where to mix in, and how — then exports the finished set as a single file. Spotify for discovery, your files for mixing.",
    stage: "Audio",
    status: "planned",
    accent: { base: "#22d3ee", soft: "rgba(34,211,238,0.12)", gradient: ["#22d3ee", "#0ea5e9"] },
    highlights: [
      "BPM / key / beatgrid analysis (in-browser DSP)",
      "AI next-track suggestions by blend score",
      "AI transition specs: fades, EQ swaps, cut points",
      "Offline mix export + .cue sheet",
    ],
    runtime: "Browser (Web Audio / AudioWorklet + WASM DSP) + Workers AI proxy",
    ai: "Suggestion re-ranking and transition specs via claude-sonnet-5 (metadata only, never raw audio)",
  },
  {
    id: "podium",
    name: "Podium",
    icon: "🎙️",
    tagline: "Podcasts, minus the tedious edit.",
    blurb:
      "Long-audio editor built for podcasters. Upload an episode and Podium strips filler words and dead air, marks chapters, and drafts show notes — edit by editing the transcript.",
    stage: "Audio",
    status: "planned",
    accent: { base: "#e879f9", soft: "rgba(232,121,249,0.12)", gradient: ["#e879f9", "#c026d3"] },
    highlights: [
      "Auto-remove \"um\"s, filler, and long silences",
      "Edit audio by editing the transcript",
      "Auto chapters + AI show notes & titles",
      "Multitrack cleanup and leveling",
    ],
    runtime: "Workers AI (Whisper) + Containers (ffmpeg) + Claude",
    ai: "Transcript understanding, chaptering, and show notes via Claude",
  },
  {
    id: "voxium",
    name: "Voxium",
    icon: "🗣️",
    tagline: "Scripts into voice.",
    blurb:
      "AI voiceover and text-to-speech. Turn a Scriptium script into clean narration in a range of voices, then send it straight to any video studio.",
    stage: "Audio",
    status: "planned",
    accent: { base: "#2dd4bf", soft: "rgba(45,212,191,0.12)", gradient: ["#2dd4bf", "#0d9488"] },
    highlights: [
      "Script → natural narration",
      "Multiple voices, pace, and emphasis control",
      "Pronunciation dictionary",
      "One click into Vidium, Editium, or Clipium",
    ],
    runtime: "Workers AI (TTS) / provider behind a clean interface",
    ai: "Voice synthesis via a TTS model; Claude tunes phrasing and SSML",
  },

  // ── Visuals ──────────────────────────────────────────────────────────────
  {
    id: "thumbium",
    name: "Thumbium",
    icon: "🖼️",
    tagline: "Thumbnails that earn the click.",
    blurb:
      "AI thumbnail and cover-art studio. Generate backgrounds, cut out your subject, drop in bold text, and A/B a batch of variants — sized for YouTube, Shorts, and every platform.",
    stage: "Visuals",
    status: "planned",
    accent: { base: "#fb923c", soft: "rgba(251,146,60,0.12)", gradient: ["#fb923c", "#ea580c"] },
    highlights: [
      "AI backgrounds + subject cutout",
      "Bold, legible text with presets",
      "A/B variant batches for CTR testing",
      "Cover art for Beatium & Songium tracks",
    ],
    runtime: "Browser canvas + Workers AI image models + R2",
    ai: "Image generation via Workers AI; Claude proposes layouts and copy",
  },
  {
    id: "imagium",
    name: "Imagium",
    icon: "🎨",
    tagline: "Generate and edit any image.",
    blurb:
      "General-purpose image studio — generate from a prompt, remove backgrounds, inpaint, and upscale. The broad visual canvas behind Thumbium's thumbnail focus.",
    stage: "Visuals",
    status: "planned",
    accent: { base: "#f472b6", soft: "rgba(244,114,182,0.12)", gradient: ["#f472b6", "#db2777"] },
    highlights: [
      "Text-to-image generation",
      "Background removal + inpaint / outpaint",
      "Upscale and restore",
      "Shared asset library with every studio",
    ],
    runtime: "Workers AI image models + R2 asset store",
    ai: "Generation and editing via image models; Claude for prompt expansion",
  },

  // ── Video ────────────────────────────────────────────────────────────────
  {
    id: "vidium",
    name: "Vidium",
    icon: "🎬",
    tagline: "CapCut, in your browser.",
    blurb:
      "A full multi-track video editor that runs entirely client-side with WebCodecs. Import, arrange, add transitions, text, filters, and keyframes, then export up to 1080p60 — no software to install.",
    stage: "Video",
    status: "planned",
    accent: { base: "#a78bfa", soft: "rgba(167,139,250,0.12)", gradient: ["#a78bfa", "#7c3aed"] },
    highlights: [
      "Multi-track timeline: split / trim / move / snap",
      "Transitions, transforms, keyframes, filters",
      "Text, stickers, chroma key",
      "WebCodecs export, in-browser",
    ],
    runtime: "Browser (WebCodecs + WebGL2 + ffmpeg.wasm fallback)",
    ai: "",
  },
  {
    id: "clipium",
    name: "Clipium",
    icon: "✂️",
    tagline: "Longform in. Shorts out.",
    blurb:
      "Watches your channel for new uploads and automatically cuts the best moments into vertical, captioned short-form clips — ready to review in a dashboard within minutes.",
    stage: "Video",
    status: "planned",
    accent: { base: "#fbbf24", soft: "rgba(251,191,36,0.12)", gradient: ["#fbbf24", "#f59e0b"] },
    highlights: [
      "Auto-detect new uploads (WebSub + poll)",
      "Whisper transcription with word timestamps",
      "Claude picks the best 3–8 moments",
      "9:16 captioned MP4s, auto-rendered",
    ],
    runtime: "Workers + Queues + Containers (yt-dlp/ffmpeg) + Workers AI + R2 + D1",
    ai: "Moment selection with claude-sonnet-5; titles & copy with claude-haiku-4-5",
  },
  {
    id: "editium",
    name: "Editium",
    icon: "🏆",
    tagline: "Raw clips to viral edit.",
    blurb:
      "Upload raw sports clips, pick a style and a track, and get back a polished vertical edit with beat-synced cuts, slow-mo on the best moments, and captions — in minutes, zero timeline editing.",
    stage: "Video",
    status: "planned",
    accent: { base: "#fb7185", soft: "rgba(251,113,133,0.12)", gradient: ["#fb7185", "#e11d48"] },
    highlights: [
      "Beat-synced cuts to a chosen track",
      "Motion/scene scoring picks best moments",
      "Auto 9:16 reframe + slow-mo + grade",
      "Style recipes: Hype, Cinematic, Retro, Clean",
    ],
    runtime: "Workers + Queues + Containers (ffmpeg/OpenCV) + R2 + D1",
    ai: "Segment ranking and hook text via Claude (Haiku)",
  },

  // ── Publish & Grow ───────────────────────────────────────────────────────
  {
    id: "postium",
    name: "Postium",
    icon: "📤",
    tagline: "Everything you make, everywhere you post.",
    blurb:
      "The publish hub. Pull in any studio's output, auto-format it per platform, then schedule and cross-post to Shorts, TikTok, Reels, and X from one calendar.",
    stage: "Publish & Grow",
    status: "planned",
    accent: { base: "#818cf8", soft: "rgba(129,140,248,0.12)", gradient: ["#818cf8", "#4f46e5"] },
    highlights: [
      "One library, every studio's exports",
      "Auto per-platform formatting",
      "Schedule + cross-post from one calendar",
      "Caption & hashtag sync from Scriptium",
    ],
    runtime: "Workers + D1 + Queues (scheduled posting) + platform APIs",
    ai: "Best-time and caption suggestions via Claude",
  },
  {
    id: "datium",
    name: "Datium",
    icon: "📊",
    tagline: "What's working, what's next.",
    blurb:
      "Analytics and trend finder that closes the loop — see how posts perform across platforms and get AI-suggested ideas for what to make next, fed straight back into Scriptium.",
    stage: "Publish & Grow",
    status: "planned",
    accent: { base: "#60a5fa", soft: "rgba(96,165,250,0.12)", gradient: ["#60a5fa", "#2563eb"] },
    highlights: [
      "Cross-platform performance in one view",
      "Trend & topic discovery",
      "AI \"make this next\" suggestions",
      "Feeds ideas back into Scriptium",
    ],
    runtime: "Workers + D1 + platform analytics APIs",
    ai: "Trend synthesis and idea generation via Claude",
  },
];

/** Ordered list of stages for grouped rendering in the hub. */
export const STAGES: StudioStage[] = [
  "Write",
  "Audio",
  "Visuals",
  "Video",
  "Publish & Grow",
];

export function studiosByStage(stage: StudioStage): StudioMeta[] {
  return STUDIOS.filter((s) => s.stage === stage);
}

export function getStudio(id: string): StudioMeta | undefined {
  return STUDIOS.find((s) => s.id === id);
}
