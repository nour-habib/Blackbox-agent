import { NavLink } from "react-router-dom";
import {
  Home,
  Activity,
  Brain,
  GitCompare,
  Terminal,
  ChevronRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "./Logo";
import { sponsorMeta } from "../../lib/display";
import { cn } from "../../lib/cn";

const items = [
  { to: "/",            label: "Overview",         icon: Home,         end: true },
  { to: "/sessions",    label: "Sessions",         icon: Activity },
  { to: "/safety",      label: "Contract",         icon: ShieldCheck },
  { to: "/memories",    label: "Memory cards",     icon: Brain },
  { to: "/assumptions", label: "Assumption shifts", icon: GitCompare },
  { to: "/cli",         label: "CLI",              icon: Terminal },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col gap-6 border-r border-[color:var(--color-border)] bg-[color:var(--color-bg-soft)]/80 px-4 pb-5 pt-5 backdrop-blur-xl lg:w-[260px]">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
                isActive
                  ? "bg-white/[0.06] text-white"
                  : "text-white/55 hover:bg-white/[0.03] hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[color:var(--color-violet-glow)]"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive
                      ? "text-[color:var(--color-violet-glow)]"
                      : "text-white/45 group-hover:text-white/70"
                  )}
                />
                {item.label}
                <ChevronRight
                  className={cn(
                    "ml-auto h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all",
                    isActive
                      ? "translate-x-0 opacity-50"
                      : "group-hover:translate-x-0 group-hover:opacity-50"
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 px-1">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-dim)]">
            <Sparkles className="h-3 w-3" />
            Powered by
          </div>
          <div className="space-y-1.5">
            {(Object.keys(sponsorMeta) as Array<keyof typeof sponsorMeta>).map((tag) => {
              const meta = sponsorMeta[tag];
              return (
                <div
                  key={tag}
                  className="flex items-center justify-between rounded-md px-1.5 py-1 text-[11.5px] hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span className="font-medium text-white/85">{tag}</span>
                  </div>
                  <span className="text-[10.5px] text-[color:var(--color-dim)]">{meta.role}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Community / docs row using the icons sprite — keeps the icons "in use" */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10.5px] text-[color:var(--color-dim)]">
          <span className="uppercase tracking-[0.18em]">community</span>
          <div className="flex items-center gap-2 text-white/55">
            {[
              { id: "github-icon", title: "github" },
              { id: "discord-icon", title: "discord" },
              { id: "x-icon", title: "x" },
            ].map((g) => (
              <button
                key={g.id}
                title={g.title}
                className="grid h-6 w-6 place-items-center rounded-md hover:bg-white/[0.05] hover:text-white"
              >
                <svg width="13" height="13" aria-hidden>
                  <use href={`/icons.svg#${g.id}`} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div className="px-2 text-[10.5px] text-[color:var(--color-dim)]">
          v0.1.0 · demo data
        </div>
      </div>
    </aside>
  );
}
