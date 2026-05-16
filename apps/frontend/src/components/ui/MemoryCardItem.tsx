import { motion } from "motion/react";
import { AlertTriangle, Brain, FileCode2, Sparkles, ShieldAlert, Workflow, Library } from "lucide-react";
import type { MemoryCard } from "../../lib/display";
import { formatRelative } from "../../lib/display";
import { Badge } from "./Badge";
import { SponsorBadge } from "./SponsorBadge";
import { cn } from "../../lib/cn";

const typeIcon = {
  episodic: Sparkles,
  semantic: Brain,
  procedural: Workflow,
  risk: ShieldAlert,
} as const;

const typeColor = {
  episodic: "var(--color-violet-glow)",
  semantic: "var(--color-electric)",
  procedural: "var(--color-acid)",
  risk: "var(--color-warn)",
} as const;

export function MemoryCardItem({
  card,
  index = 0,
  compact = false,
}: {
  card: MemoryCard;
  index?: number;
  compact?: boolean;
}) {
  const Icon = typeIcon[card.type];
  const color = typeColor[card.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.45, delay: index * 0.04 }}
      whileHover={{ y: -2 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-[color:var(--color-surface)] p-5 transition-colors",
        card.is_stale
          ? "border-[color:var(--color-warn)]/30"
          : "border-[color:var(--color-border)] hover:border-white/15"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ background: color }}
      />

      {card.is_stale && (
        <div className="absolute right-3 top-3">
          <Badge tone="warn" icon={<AlertTriangle className="h-3 w-3" />}>
            Stale
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: `color-mix(in oklab, ${color} 14%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 30%, transparent)`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--color-dim)]">
            <span style={{ color }}>{card.type}</span>
            <span>•</span>
            <span>{formatRelative(card.created_at)}</span>
          </div>
        </div>
      </div>

      <h4 className="mt-3 text-[15px] font-semibold leading-snug text-white">
        {card.title}
      </h4>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-muted)]">
        {card.content}
      </p>

      {!compact && card.evidence.length > 0 && (
        <div className="mt-3 space-y-1 border-l border-white/10 pl-3">
          {card.evidence.map((e, i) => (
            <div key={i} className="text-[11.5px] text-white/55">
              <span className="text-[color:var(--color-dim)]">— </span>
              <span className="font-mono">{e}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="muted">
          <Library className="h-3 w-3" />
          {card.confidence} confidence
        </Badge>
        {card.source_files.slice(0, 2).map((f) => (
          <Badge key={f} tone="muted">
            <FileCode2 className="h-3 w-3" />
            <span className="font-mono text-[10.5px]">{f.split("/").pop()}</span>
          </Badge>
        ))}
        <SponsorBadge tag={card.generated_by} prefix="by" className="ml-auto" />
      </div>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.retrieve_when.slice(0, 5).map((k) => (
            <span
              key={k}
              className="rounded-md border border-white/5 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10.5px] text-white/55"
            >
              #{k}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
