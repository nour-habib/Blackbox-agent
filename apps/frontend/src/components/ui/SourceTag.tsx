import { RefreshCw, Loader2, CircleDot, CircleDashed, AlertTriangle } from "lucide-react";
import type { Source } from "../../lib/useApi";
import { cn } from "../../lib/cn";

/**
 * Small status badge: live · empty · error. Used by pages that fetch
 * backend data so the operator can tell at a glance whether the dashboard
 * has data, no data, or hit a network error.
 */
export function SourceTag({
  source,
  loading,
  onRefresh,
  className,
}: {
  source: Source;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}) {
  const meta =
    source === "live"
      ? {
          Icon: CircleDot,
          label: "live · backend",
          cls: "border-[color:var(--color-success)]/35 bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]",
        }
      : source === "error"
      ? {
          Icon: AlertTriangle,
          label: "backend unreachable",
          cls: "border-[color:var(--color-danger)]/35 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
        }
      : {
          Icon: CircleDashed,
          label: "no data yet",
          cls: "border-white/10 bg-white/[0.03] text-white/55",
        };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        meta.cls,
        className
      )}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <meta.Icon className="h-3 w-3" />}
      {meta.label}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="-mr-1 ml-1 grid h-4 w-4 place-items-center rounded hover:bg-white/10"
          title="refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
