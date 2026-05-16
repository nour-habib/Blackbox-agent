import { sponsorMeta, type SponsorTag } from "../../lib/display";
import { cn } from "../../lib/cn";

export function SponsorBadge({
  tag,
  className,
  prefix,
}: {
  tag: SponsorTag;
  className?: string;
  prefix?: string;
}) {
  const meta = sponsorMeta[tag];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        className
      )}
      style={{
        color: meta.color,
        background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
        borderColor: `color-mix(in oklab, ${meta.color} 35%, transparent)`,
      }}
      title={meta.description}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
      />
      {prefix && <span className="text-white/55">{prefix}</span>}
      {tag}
    </span>
  );
}
