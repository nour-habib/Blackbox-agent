import { Link, useLocation } from "react-router-dom";
import { Menu, Search, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "../ui/Button";
import { Logo } from "./Logo";
import { useApiHealth } from "../../lib/useApi";

function useCrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; to: string }[] = [{ label: "witsmith", to: "/" }];
  let path = "";
  for (const p of parts) {
    path += `/${p}`;
    const label = p.startsWith("session_")
      ? p.replace("session_", "session ")
      : p === "safety"
      ? "Contract"
      : p.charAt(0).toUpperCase() + p.slice(1);
    crumbs.push({ label, to: path });
  }
  return crumbs;
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const crumbs = useCrumbs();
  const { live, checking } = useApiHealth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={onMenuClick}
        className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/5 hover:text-white lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="lg:hidden">
        <Logo size={24} />
      </div>

      <nav className="hidden min-w-0 items-center gap-1.5 text-[12.5px] lg:flex">
        {crumbs.map((c, i) => (
          <div key={c.to} className="flex items-center gap-1.5 truncate">
            {i > 0 && <ChevronRight className="h-3 w-3 text-white/25" />}
            <Link
              to={c.to}
              className={`truncate ${
                i === crumbs.length - 1 ? "text-white" : "text-white/45 hover:text-white"
              }`}
            >
              {c.label}
            </Link>
          </div>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div
          className={
            "hidden h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors sm:inline-flex " +
            (checking
              ? "border-white/10 bg-white/[0.03] text-white/55"
              : live
              ? "border-[color:var(--color-success)]/35 bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]"
              : "border-white/10 bg-white/[0.03] text-white/50")
          }
          title={live ? "Backend reachable at /api" : "Backend not reachable — using mock data"}
        >
          <span className="relative flex h-1.5 w-1.5">
            {live && !checking && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--color-success)] opacity-60" />
            )}
            <span
              className={
                "relative inline-flex h-1.5 w-1.5 rounded-full " +
                (live
                  ? "bg-[color:var(--color-success)]"
                  : checking
                  ? "bg-white/40 animate-pulse"
                  : "bg-white/30")
              }
            />
          </span>
          {checking ? "checking api…" : live ? "api live" : "api offline"}
        </div>
        <div className="hidden h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12.5px] text-white/55 transition-colors hover:border-white/20 md:flex">
          <Search className="h-3.5 w-3.5" />
          <span>Search sessions, files, memories…</span>
          <span className="ml-3 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/55">
            ⌘K
          </span>
        </div>
        <a
          href="/cli"
          className="hidden h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] text-white/70 hover:bg-white/5 hover:text-white sm:inline-flex"
        >
          <BookOpen className="h-3.5 w-3.5" /> docs
        </a>
        <Button size="sm" iconLeft={<span className="h-1.5 w-1.5 rounded-full bg-white/70" />}>
          Start session
        </Button>
      </div>
    </header>
  );
}
