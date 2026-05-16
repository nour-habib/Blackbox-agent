/**
 * Typed client for the witsmith backend (apps/backend).
 *
 * Backend types use camelCase (matching apps/core), while several frontend
 * components were authored against the snake_case mock shapes in mockData.
 * The adapters below bridge that gap so existing components stay untouched.
 *
 * Every call goes through `/api/...` and is proxied to the backend by Vite
 * in dev (see vite.config.ts) — no CORS hops in the browser.
 */
import type {
  MemoryCard as UiMemoryCard,
  SafetyEvent as UiSafetyEvent,
  ContractRule as UiContractRule,
  SponsorTag,
} from "./display";

/* --------------------------- backend wire types --------------------------- */

export type ApiMemoryCard = {
  id: string;
  sessionId: string;
  type: "episodic" | "semantic" | "procedural" | "risk";
  claimType: "observed" | "agent_reported" | "inferred";
  content: string;
  evidence: string[];
  sourceFiles: string[];
  confidence: "low" | "medium" | "high";
  retrieveWhen: string[];
  staleIfChanged: string[];
  isStale: boolean;
  createdAt: string;
};

export type ApiSessionSummary = {
  id: string;
  task: string;
  repoPath: string;
  branch: string;
  baseCommit: string;
  endCommit: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  changedFiles: string[];
  actionCount: number;
  memoryCardCount: number;
};

export type ApiSafetyEvent = {
  action_id: string;
  ts: string;
  command: string;
  cwd: string;
  source: string;
  session_id?: string;
  decision: "allow" | "ask" | "deny";
  reason?: string;
  matched_rule?: string;
  confidence?: number;
  cache_hit?: boolean;
  executed: boolean;
  exit_code?: number | null;
  stdout?: string;
  stderr?: string;
};

export type ApiContractRule = {
  decision: "allow" | "ask" | "deny";
  pattern: string;
  reason?: string;
};

export type ApiHealth = {
  ok: boolean;
  repoPath: string;
  sessionsDir: string;
  hasContract: boolean;
  hasLog: boolean;
};

export type ApiAction = {
  action_id: string;
  ts: string;
  command: string;
  cwd: string;
  source: string;
  session_id?: string;
  decision: "allow" | "ask" | "deny";
  reason?: string;
  matched_rule?: string;
  confidence?: number;
  cache_hit?: boolean;
  executed: boolean;
  exit_code?: number | null;
  stdout?: string;
  stderr?: string;
};

/** Full SessionFile returned by GET /api/sessions/:id. */
export type ApiSessionFile = {
  evidenceBundle: {
    id: string;
    task: string;
    repoPath: string;
    branch?: string;
    baseCommit?: string;
    endCommit?: string;
    startedAt: string;
    finishedAt?: string;
    status: string;
    changedFiles: string[];
    diff: string;
    actions: ApiAction[];
    agentTrace?: string;
  };
  report: {
    summary?: string;
    observedFacts?: string[];
    agentReportedClaims?: string[];
    inferredHypotheses?: string[];
    memoryCards?: ApiMemoryCard[];
  };
};

export type ApiContextResult = {
  task: string;
  memories: ApiMemoryCard[];
  contextBlock: string;
};

export type ApiStaleCheckResult = {
  checked: number;
  staleCount: number;
  stalledMemories: ApiMemoryCard[];
};

/* --------------------------- fetch helpers --------------------------- */

const DEFAULT_TIMEOUT_MS = 4000;

async function request<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------- endpoints --------------------------- */

export const api = {
  health: () => request<ApiHealth>("/api/health", { timeoutMs: 1500 }),

  sessions: () => request<ApiSessionSummary[]>("/api/sessions"),
  session: (id: string) => request<ApiSessionFile>(`/api/sessions/${encodeURIComponent(id)}`),

  memories: (sessionId?: string) =>
    request<ApiMemoryCard[]>(
      sessionId
        ? `/api/memories?sessionId=${encodeURIComponent(sessionId)}`
        : "/api/memories"
    ),

  context: (task: string, limit = 5) =>
    request<ApiContextResult>("/api/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, limit }),
      timeoutMs: 15000,
    }),

  staleCheck: () =>
    request<ApiStaleCheckResult>("/api/stale-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      timeoutMs: 10000,
    }),

  safetyRules: () =>
    request<{ rules: ApiContractRule[]; missing: boolean; source: string }>(
      "/api/safety/rules"
    ),

  safetyEvents: (limit = 100) =>
    request<ApiSafetyEvent[]>(`/api/safety/events?limit=${limit}`),
};

/* --------------------------- adapters: backend → mock shapes --------------------------- */

/**
 * Heuristic: choose a sponsor tag for a backend memory card. The backend
 * doesn't track `generated_by`, but in practice today every card comes from
 * CLōD — and that's what we want to display.
 */
function pickGeneratedBy(): SponsorTag {
  return "CLōD";
}

export function adaptMemoryCard(card: ApiMemoryCard): UiMemoryCard {
  return {
    id: card.id,
    session_id: card.sessionId,
    type: card.type,
    title: deriveTitle(card.content),
    content: card.content,
    evidence: card.evidence ?? [],
    source_files: card.sourceFiles ?? [],
    confidence: card.confidence,
    retrieve_when: card.retrieveWhen ?? [],
    stale_if_changed: card.staleIfChanged ?? [],
    is_stale: Boolean(card.isStale),
    created_at: card.createdAt,
    generated_by: pickGeneratedBy(),
    retrieved_count: 0,
  };
}

/** Backend memory cards have no separate `title` — derive a short one. */
function deriveTitle(content: string): string {
  const firstSentence = content.split(/(?<=[.!?])\s/)[0] ?? content;
  if (firstSentence.length <= 80) return firstSentence;
  return firstSentence.slice(0, 77).trimEnd() + "…";
}

export function adaptSafetyEvent(ev: ApiSafetyEvent): UiSafetyEvent {
  return {
    id: ev.action_id,
    ts: ev.ts,
    command: ev.command,
    cwd: ev.cwd,
    decision: ev.decision,
    matched_rule: ev.matched_rule ?? "—",
    reason: ev.reason ?? "",
    confidence: typeof ev.confidence === "number" ? ev.confidence : 0.5,
    executed: Boolean(ev.executed),
    exit_code:
      ev.exit_code === null || ev.exit_code === undefined ? undefined : ev.exit_code,
    source: ev.source === "agent" || ev.source === "user" ? ev.source : "agent",
  };
}

export function adaptContractRule(r: ApiContractRule): UiContractRule {
  return { decision: r.decision, pattern: r.pattern, reason: r.reason };
}
