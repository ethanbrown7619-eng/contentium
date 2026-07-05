import { STAGES, STUDIOS, studiosByStage, type StudioStage } from "@contentium/ui";
import { StudioCard } from "@/studio/StudioCard";

const STAGE_BLURB: Record<StudioStage, string> = {
  Write: "Ideate and script — the front of the funnel.",
  Audio: "Beats, full songs, DJ mixes, podcasts, and voice.",
  Visuals: "Thumbnails and images that earn the click.",
  Video: "Hands-on editing and one-tap auto-edits.",
  "Publish & Grow": "Distribute everywhere, then learn what's working.",
};

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xl font-bold text-ink">{n}</span>
      <span className="text-sm text-ink-3">{label}</span>
    </div>
  );
}

function Hero() {
  return (
    <header>
      <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-panel px-3 py-1 text-xs font-medium text-ink-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        The ultimate creation suite
      </span>
      <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">
        <span className="gradient-text">Contentium</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
        Thirteen AI studios, one workflow — from the first idea to the final
        post. Write it, produce it, edit it, publish it, grow it.
      </p>
      <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3">
        <Stat n="13" label="studios" />
        <Stat n="5" label="pipeline stages" />
        <Stat n="100%" label="on Cloudflare" />
      </div>
    </header>
  );
}

export function Hub() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
      <Hero />

      {STAGES.map((stage) => {
        const studios = studiosByStage(stage);
        return (
          <section key={stage} className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{stage}</h2>
                <p className="mt-1 text-sm text-ink-3">{STAGE_BLURB[stage]}</p>
              </div>
              <span className="shrink-0 text-sm text-ink-3">
                {studios.length}{" "}
                {studios.length === 1 ? "studio" : "studios"}
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {studios.map((studio) => (
                <StudioCard key={studio.id} studio={studio} />
              ))}
            </div>
          </section>
        );
      })}

      <footer className="mt-16 border-t border-hair pt-6 text-sm text-ink-3">
        {STUDIOS.length} studios · one platform · built on Cloudflare Workers,
        R2, D1, Queues, Containers &amp; Workers AI, with Claude for the thinking.
      </footer>
    </div>
  );
}
