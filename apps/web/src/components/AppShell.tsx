import { NavLink, Link, Outlet } from "react-router-dom";
import { STAGES, studiosByStage, type StudioMeta } from "@contentium/ui";

function RailGlyph({ studio }: { studio: StudioMeta }) {
  return (
    <NavLink
      to={`/s/${studio.id}`}
      title={`${studio.name} — ${studio.tagline}`}
      className="rail-link flex h-11 w-11 items-center justify-center rounded-xl text-lg hover:bg-raised"
      style={{ ["--accent" as string]: studio.accent.base }}
    >
      <span aria-hidden>{studio.icon}</span>
      <span className="sr-only">{studio.name}</span>
    </NavLink>
  );
}

export function AppShell() {
  return (
    <div className="flex h-full">
      {/* ── Left rail ─────────────────────────────────────────────────── */}
      <aside className="flex w-[76px] shrink-0 flex-col items-center gap-4 border-r border-hair bg-panel/60 py-4 backdrop-blur">
        <Link
          to="/"
          title="Contentium home"
          className="accent-glyph flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black text-white"
          style={{
            ["--accent-from" as string]: "#6366f1",
            ["--accent-to" as string]: "#d946ef",
          }}
        >
          C
        </Link>

        <div className="h-px w-8 bg-hair" />

        <nav className="flex flex-1 flex-col items-center gap-3 overflow-y-auto">
          {STAGES.map((stage) => (
            <div key={stage} className="flex flex-col items-center gap-1.5">
              {studiosByStage(stage).map((studio) => (
                <RailGlyph key={studio.id} studio={studio} />
              ))}
              <div className="mt-1 h-px w-6 bg-hair/70" />
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main className="h-full flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
