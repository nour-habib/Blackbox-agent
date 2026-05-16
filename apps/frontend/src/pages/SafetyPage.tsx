import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Clock,
  Bot,
  User as UserIcon,
  Search,
  PlayCircle,
  XCircle,
} from "lucide-react";
import {
  type ContractDecision,
  type SafetyEvent,
} from "../lib/display";
import { useContractRules, useSafetyEvents } from "../lib/useApi";
import { Badge } from "../components/ui/Badge";
import { SourceTag } from "../components/ui/SourceTag";
import { cn } from "../lib/cn";

/**
 * Contract / safety surface — the "command gatekeeper" half of witsmith.
 * Covers AGENT_WIT.yaml rules + the live allow/ask/deny event log so this
 * piece of the README ("the most important existing behavior is `witsmith
 * run`") finally has a home in the dashboard.
 */
export function SafetyPage() {
  const [filter, setFilter] = useState<"all" | ContractDecision>("all");
  const [query, setQuery] = useState("");
  const {
    data: contractRules,
    source: rulesSource,
    loading: rulesLoading,
    refresh: refreshRules,
  } = useContractRules();
  const {
    data: safetyEvents,
    source: eventsSource,
    loading: eventsLoading,
    refresh: refreshEvents,
  } = useSafetyEvents();

  // Pick the most informative source so a single tag tells the truth.
  const pageSource =
    rulesSource === "error" || eventsSource === "error"
      ? "error"
      : rulesSource === "live" && eventsSource === "live"
      ? "live"
      : "empty";
  const pageLoading = rulesLoading || eventsLoading;
  const refreshBoth = () => {
    refreshRules();
    refreshEvents();
  };

  const filtered = useMemo(() => {
    return safetyEvents.filter((e) => {
      const matchDecision = filter === "all" || e.decision === filter;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        e.command.toLowerCase().includes(q) ||
        e.matched_rule.toLowerCase().includes(q) ||
        e.cwd.toLowerCase().includes(q);
      return matchDecision && matchQuery;
    });
  }, [safetyEvents, filter, query]);

  const counts = useMemo(() => {
    return {
      allow: safetyEvents.filter((e) => e.decision === "allow").length,
      ask: safetyEvents.filter((e) => e.decision === "ask").length,
      deny: safetyEvents.filter((e) => e.decision === "deny").length,
    };
  }, [safetyEvents]);

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="violet">
                <ShieldCheck className="h-3 w-3" /> command gatekeeper
              </Badge>
              <SourceTag source={pageSource} loading={pageLoading} onRefresh={refreshBoth} />
            </div>
            <h1 className="font-serif text-[34px] leading-tight text-white text-balance md:text-[44px]">
              Every command, gated by your contract.
            </h1>
            <p className="mt-3 max-w-2xl text-[14.5px] text-white/60">
              <span className="font-mono text-white/80">witsmith run</span> matches each command
              against <span className="font-mono text-white/80">AGENT_WIT.yaml</span>, decides
              <span className="text-[color:var(--color-success)]"> allow</span>,
              <span className="text-[color:var(--color-warn)]"> ask</span> or
              <span className="text-[color:var(--color-danger)]"> deny</span>, and appends the
              decision to <span className="font-mono text-white/80">.witsmith/log.jsonl</span>.
            </p>
          </div>
        </div>

        {/* Decision counters */}
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <DecisionStat
            decision="allow"
            count={counts.allow}
            label="Allowed"
            sub="Read-only or whitelisted commands"
          />
          <DecisionStat
            decision="ask"
            count={counts.ask}
            label="Asked"
            sub="Operator confirmation required"
          />
          <DecisionStat
            decision="deny"
            count={counts.deny}
            label="Denied"
            sub="Blocked before execution"
          />
        </div>

        {/* Two-up: contract + log */}
        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          {/* Contract preview */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="elev-1 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
          >
            <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-white/85">AGENT_WIT.yaml</span>
                <Badge tone="muted">contract</Badge>
              </div>
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--color-dim)]">
                repo root
              </span>
            </header>
            <div className="space-y-4 px-5 py-4">
              {(["allow", "ask", "deny"] as ContractDecision[]).map((d) => {
                const rules = contractRules.filter((r) => r.decision === d);
                if (!rules.length) return null;
                const tone = decisionTone(d);
                return (
                  <div key={d}>
                    <div
                      className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em]"
                      style={{ color: tone.text }}
                    >
                      <tone.Icon className="h-3 w-3" />
                      {d}
                    </div>
                    <ul className="space-y-1.5">
                      {rules.map((r) => (
                        <li
                          key={r.pattern}
                          className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                        >
                          <code className="font-mono text-[12px] text-white/90">
                            {r.pattern}
                          </code>
                          {r.reason && (
                            <div className="mt-0.5 text-[11.5px] text-white/45">
                              {r.reason}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Event log */}
          <div>
            {/* Filter row */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by command, rule, repo…"
                  className="h-10 w-full rounded-full border border-white/10 bg-white/[0.03] pl-9 pr-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-[color:var(--color-violet-glow)]/40"
                />
              </div>
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
                {(["all", "allow", "ask", "deny"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setFilter(d)}
                    className={cn(
                      "relative rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                      filter === d ? "text-white" : "text-white/60 hover:text-white"
                    )}
                  >
                    {filter === d && (
                      <motion.span
                        layoutId="contract-pill"
                        className="absolute inset-0 rounded-full"
                        style={{
                          background:
                            d === "all"
                              ? "rgba(196,123,255,0.2)"
                              : d === "allow"
                              ? "rgba(93,223,155,0.18)"
                              : d === "ask"
                              ? "rgba(255,200,87,0.18)"
                              : "rgba(255,100,100,0.18)",
                          boxShadow: `inset 0 0 0 1px ${
                            d === "all"
                              ? "rgba(196,123,255,0.45)"
                              : d === "allow"
                              ? "rgba(93,223,155,0.4)"
                              : d === "ask"
                              ? "rgba(255,200,87,0.45)"
                              : "rgba(255,100,100,0.5)"
                          }`,
                        }}
                        transition={{ type: "spring", stiffness: 320, damping: 30 }}
                      />
                    )}
                    <span className="relative capitalize">{d}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="elev-1 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/70">
              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-white/55">
                  No events match.
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {filtered.map((e, i) => (
                    <SafetyEventRow key={e.id} event={e} index={i} />
                  ))}
                </ul>
              )}
            </div>

            <p className="mt-3 px-1 text-[11.5px] text-white/45">
              Live tail of <span className="font-mono">.witsmith/log.jsonl</span> served by{" "}
              <span className="font-mono">/api/safety/events</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Pieces --------------------------- */

function decisionTone(d: ContractDecision) {
  if (d === "allow")
    return {
      Icon: ShieldCheck,
      text: "var(--color-success)",
      bg: "rgba(93,223,155,0.10)",
      border: "rgba(93,223,155,0.32)",
    };
  if (d === "ask")
    return {
      Icon: ShieldAlert,
      text: "var(--color-warn)",
      bg: "rgba(255,200,87,0.10)",
      border: "rgba(255,200,87,0.34)",
    };
  return {
    Icon: ShieldOff,
    text: "var(--color-danger)",
    bg: "rgba(255,100,100,0.10)",
    border: "rgba(255,100,100,0.36)",
  };
}

function DecisionStat({
  decision,
  count,
  label,
  sub,
}: {
  decision: ContractDecision;
  count: number;
  label: string;
  sub: string;
}) {
  const tone = decisionTone(decision);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="elev-1 relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg border"
            style={{ background: tone.bg, borderColor: tone.border }}
          >
            <tone.Icon className="h-3.5 w-3.5" style={{ color: tone.text }} />
          </span>
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="font-serif text-[40px] leading-none text-white">{count}</span>
        <span className="text-[11.5px] text-white/45">{sub}</span>
      </div>
    </motion.div>
  );
}

function SafetyEventRow({ event, index }: { event: SafetyEvent; index: number }) {
  const tone = decisionTone(event.decision);
  const SourceIcon = event.source === "agent" ? Bot : UserIcon;

  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, delay: index * 0.03 }}
      className="grid grid-cols-1 gap-3 px-5 py-3 lg:grid-cols-[110px_1fr_auto] lg:items-center"
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
          style={{
            color: tone.text,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
          }}
        >
          <tone.Icon className="h-3 w-3" /> {event.decision}
        </span>
      </div>

      <div className="min-w-0">
        <code className="block truncate font-mono text-[13px] text-white">
          {event.command}
        </code>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-white/45">
          <span className="font-mono">matched: {event.matched_rule}</span>
          <span>·</span>
          <span>{event.reason}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11.5px] text-white/55 lg:justify-end">
        <span className="inline-flex items-center gap-1">
          <SourceIcon className="h-3 w-3 text-white/45" />
          {event.source}
        </span>
        <span className="inline-flex items-center gap-1">
          {event.executed ? (
            <PlayCircle className="h-3 w-3 text-[color:var(--color-success)]" />
          ) : (
            <XCircle className="h-3 w-3 text-white/35" />
          )}
          {event.executed ? `exit ${event.exit_code ?? 0}` : "blocked"}
        </span>
        <span className="inline-flex items-center gap-1 font-mono">
          <Clock className="h-3 w-3 text-white/35" />
          {new Date(event.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>
    </motion.li>
  );
}
