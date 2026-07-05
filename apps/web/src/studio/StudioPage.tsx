import { useParams, Link } from "react-router-dom";
import { STUDIOS, getStudio } from "@contentium/ui";
import { StatusPill } from "@/studio/StudioCard";

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-4 text-2xl font-semibold text-ink">Studio not found</h1>
      <p className="mt-2 text-ink-3">
        That studio isn't in the roster (yet).
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg border border-hair bg-panel px-4 py-2 text-sm text-ink-2 hover:bg-raised"
      >
        ← Back to the hub
      </Link>
    </div>
  );
}

export function StudioPage() {
  const { studioId } = useParams<{ studioId: string }>();
  const studio = studioId ? getStudio(studioId) : undefined;
  if (!studio) return <NotFound />;

  const idx = STUDIOS.findIndex((s) => s.id === studio.id);
  const prev = idx > 0 ? STUDIOS[idx - 1] : undefined;
  const next = idx < STUDIOS.length - 1 ? STUDIOS[idx + 1] : undefined;

  return (
    <div
      className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-12"
      style={{ ["--accent" as string]: studio.accent.base }}
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink-2"
      >
        ← All studios
      </Link>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="hero-panel mt-4 flex flex-col gap-5 rounded-3xl p-8 md:flex-row md:items-center md:gap-7">
        <span
          className="accent-glyph flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl"
          style={{
            ["--accent-from" as string]: studio.accent.gradient[0],
            ["--accent-to" as string]: studio.accent.gradient[1],
          }}
          aria-hidden
        >
          {studio.icon}
        </span>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-ink">{studio.name}</h1>
            <StatusPill status={studio.status} />
            <span className="rounded-full border border-hair px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-3">
              {studio.stage}
            </span>
          </div>
          <p
            className="mt-1 text-lg font-medium"
            style={{ color: studio.accent.base }}
          >
            {studio.tagline}
          </p>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">
            {studio.blurb}
          </p>
        </div>
      </section>

      {/* ── Details ───────────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-hair bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            What it does
          </h2>
          <ul className="mt-4 space-y-2.5">
            {studio.highlights.map((h) => (
              <li key={h} className="flex gap-2.5 text-sm text-ink-2">
                <span style={{ color: studio.accent.base }}>▸</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-hair bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            Under the hood
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-ink-3">Runtime</dt>
              <dd className="mt-0.5 text-ink-2">{studio.runtime}</dd>
            </div>
            <div>
              <dt className="text-ink-3">AI</dt>
              <dd className="mt-0.5 text-ink-2">
                {studio.ai || "No AI at runtime — pure client-side."}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── Workspace placeholder ─────────────────────────────────────── */}
      <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hair-strong bg-panel/40 px-6 py-14 text-center">
        <span className="text-3xl" aria-hidden>
          🚧
        </span>
        <p className="text-ink-2">
          The <span className="font-semibold text-ink">{studio.name}</span>{" "}
          workspace is being built.
        </p>
        <p className="max-w-md text-sm text-ink-3">
          This studio's landing is live and wired into the suite. Its interactive
          workspace is next up on the roadmap.
        </p>
      </div>

      {/* ── Prev / next ───────────────────────────────────────────────── */}
      <nav className="mt-8 flex items-center justify-between gap-4 text-sm">
        {prev ? (
          <Link
            to={`/s/${prev.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-hair bg-panel px-3 py-2 text-ink-2 hover:bg-raised"
          >
            <span aria-hidden>{prev.icon}</span>← {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to={`/s/${next.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-hair bg-panel px-3 py-2 text-ink-2 hover:bg-raised"
          >
            {next.name} →<span aria-hidden>{next.icon}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
