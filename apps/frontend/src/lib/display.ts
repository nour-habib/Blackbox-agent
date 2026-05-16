/**
 * Display-only types + pure utility helpers used across the UI.
 *
 * This file replaces the previous `mockData.ts` (deleted): every page now
 * pulls its data from the backend via `useApi`. Only the type definitions
 * the components reference and a handful of pure formatters survive here.
 *
 * If a UI component still expects a field the backend doesn't return, the
 * page leaves that field blank instead of inventing a fixture.
 */

/* --------------------------- shared union types --------------------------- */

export type SponsorTag = "CLōD" | "Nia" | "Greptile";

export type SessionStatus = "success" | "failed" | "partial" | "running" | "finished";

export type ContractDecision = "allow" | "ask" | "deny";

/* --------------------------- domain types --------------------------- */

/**
 * UI-facing memory card. Backend wire shape is camelCase; adapters in
 * `api.ts` translate to this snake_case shape so existing components work
 * unchanged. Mock-only fields (`title`, `generated_by`, `retrieved_count`)
 * are derived from the live payload — see `adaptMemoryCard`.
 */
export type MemoryCard = {
  id: string;
  session_id: string;
  type: "episodic" | "semantic" | "procedural" | "risk";
  title: string;
  content: string;
  evidence: string[];
  source_files: string[];
  confidence: "low" | "medium" | "high";
  retrieve_when: string[];
  stale_if_changed: string[];
  is_stale: boolean;
  created_at: string;
  generated_by: SponsorTag;
  retrieved_count: number;
};

export type ContractRule = {
  decision: ContractDecision;
  pattern: string;
  reason?: string;
};

export type SafetyEvent = {
  id: string;
  ts: string;
  command: string;
  cwd: string;
  decision: ContractDecision;
  matched_rule: string;
  reason: string;
  confidence: number;
  executed: boolean;
  exit_code?: number;
  source: "user" | "agent";
};

/* --------------------------- presentation metadata --------------------------- */

export const sponsorMeta: Record<
  SponsorTag,
  { color: string; description: string; role: string }
> = {
  CLōD: {
    color: "#b289ff",
    description: "Memory card generation and session summarization.",
    role: "Generator",
  },
  Nia: {
    color: "#6ea8ff",
    description: "Indexes & retrieves memory cards for new tasks.",
    role: "Retrieval",
  },
  Greptile: {
    color: "#5ddf9b",
    description: "Codebase-aware diff review and risk surfacing.",
    role: "Diff review",
  },
};

/* --------------------------- formatters --------------------------- */

export function statusMeta(status: SessionStatus): {
  label: string;
  dot: string;
  text: string;
  bg: string;
} {
  switch (status) {
    case "success":
    case "finished":
      return {
        label: status === "finished" ? "Finished" : "Resolved",
        dot: "bg-[color:var(--color-success)]",
        text: "text-[color:var(--color-success)]",
        bg: "bg-[color:var(--color-success)]/10",
      };
    case "failed":
      return {
        label: "Failed",
        dot: "bg-[color:var(--color-danger)]",
        text: "text-[color:var(--color-danger)]",
        bg: "bg-[color:var(--color-danger)]/10",
      };
    case "partial":
      return {
        label: "Partial",
        dot: "bg-[color:var(--color-warn)]",
        text: "text-[color:var(--color-warn)]",
        bg: "bg-[color:var(--color-warn)]/10",
      };
    case "running":
      return {
        label: "Running",
        dot: "bg-[color:var(--color-electric)]",
        text: "text-[color:var(--color-electric)]",
        bg: "bg-[color:var(--color-electric)]/10",
      };
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}
