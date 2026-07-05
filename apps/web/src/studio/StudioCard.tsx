import { Link } from "react-router-dom";
import type { StudioMeta, StudioStatus } from "@contentium/ui";

export function StatusPill({ status }: { status: StudioStatus }) {
  const label =
    status === "live" ? "Live" : status === "beta" ? "Beta" : "Planned";
  return (
    <span className="rounded-full border border-hair bg-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-3">
      {label}
    </span>
  );
}

export function StudioCard({ studio }: { studio: StudioMeta }) {
  return (
    <Link
      to={`/s/${studio.id}`}
      className="studio-card group flex flex-col gap-3 rounded-2xl p-5"
      style={{ ["--accent" as string]: studio.accent.base }}
    >
      <div className="flex items-center gap-3">
        <span
          className="accent-glyph flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{
            ["--accent-from" as string]: studio.accent.gradient[0],
            ["--accent-to" as string]: studio.accent.gradient[1],
          }}
          aria-hidden
        >
          {studio.icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink">
              {studio.name}
            </h3>
            <StatusPill status={studio.status} />
          </div>
          <p className="truncate text-sm text-ink-2">{studio.tagline}</p>
        </div>
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-ink-3">
        {studio.blurb}
      </p>

      <span
        className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium"
        style={{ color: studio.accent.base }}
      >
        Open studio
        <span className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
