import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  GitBranch,
  Clock,
  GitCommit,
  FileCode2,
  Terminal,
  Brain,
  Hash,
  AlertOctagon,
  Sparkles,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Bot,
  User as UserIcon,
} from "lucide-react";
import { formatDuration, formatRelative, statusMeta } from "../lib/display";
import { useSessionDetail, useMemories } from "../lib/useApi";
import { adaptMemoryCard } from "../lib/api";
import type { ApiAction, ApiSessionFile } from "../lib/api";
import { Badge } from "../components/ui/Badge";
import { MemoryCardItem } from "../components/ui/MemoryCardItem";
import { cn } from "../lib/cn";

const tabs = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "actions", label: "Actions", icon: Terminal },
  { id: "report", label: "Report", icon: AlertOctagon },
  { id: "memory", label: "Memory cards", icon: Brain },
  { id: "trace", label: "Agent trace", icon: FileCode2 },
] as const;

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: file, loading, error } = useSessionDetail(id);
  const { data: allMemories } = useMemories(id);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("overview");
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="px-4 py-12 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" /> loading session…
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-white/15 bg-[color:var(--color-surface)]/60 p-8 text-center">
          <Link
            to="/sessions"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-white/55 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> all sessions
          </Link>
          <h1 className="mt-4 font-serif text-[24px] text-white">Session not found.</h1>
          <p className="mt-2 text-[13px] text-white/55">
            {error ?? `No session with id "${id}" was returned by /api/sessions/:id.`}
          </p>
        </div>
      </div>
    );
  }

  const bundle = file.evidenceBundle;
  const report = file.report ?? {};
  const meta = statusMeta((bundle.status as never) ?? "finished");
  const actions = bundle.actions ?? [];
  const cards = (allMemories ?? []).filter((c) => c.session_id === bundle.id);
  const reportCards = (report.memoryCards ?? []).map(adaptMemoryCard);
  const mergedCards = cards.length > 0 ? cards : reportCards;

  const startedMs = new Date(bundle.startedAt).getTime();
  const finishedMs = bundle.finishedAt ? new Date(bundle.finishedAt).getTime() : NaN;
  const durMs = Number.isFinite(finishedMs) ? finishedMs - startedMs : NaN;

  function copyId() {
    navigator.clipboard?.writeText(bundle.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-white/55 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> all sessions
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  meta.bg,
                  meta.text,
                  "border-current/40"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </span>
              <button
                onClick={copyId}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-white/70 transition-colors hover:border-white/20"
              >
                <Hash className="h-3 w-3" /> {bundle.id}
                {copied ? (
                  <Check className="h-3 w-3 text-[color:var(--color-success)]" />
                ) : (
                  <Copy className="h-3 w-3 text-white/40" />
                )}
              </button>
            </div>

            <h1 className="mt-3 font-serif text-[34px] leading-tight text-white text-balance md:text-[44px]">
              {bundle.task || "(no task description)"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-white/40" />
                <span className="font-mono text-white/85">{bundle.branch || "—"}</span>
              </span>
              {(bundle.baseCommit || bundle.endCommit) && (
                <span className="inline-flex items-center gap-1.5">
                  <GitCommit className="h-3.5 w-3.5 text-white/40" />
                  <span className="font-mono text-white/85">
                    {bundle.baseCommit?.slice(0, 7) || "—"}
                  </span>
                  <span className="text-white/30">→</span>
                  <span className="font-mono text-[color:var(--color-acid)]">
                    {bundle.endCommit?.slice(0, 7) || "—"}
                  </span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-white/40" />
                {formatDuration(durMs)} · {formatRelative(bundle.startedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats — only fields backend exposes; empty/blank otherwise */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <Mini
            label="Files touched"
            value={String(bundle.changedFiles?.length ?? 0)}
            sub={
              bundle.changedFiles?.length
                ? `${bundle.changedFiles.length} path${bundle.changedFiles.length === 1 ? "" : "s"}`
                : "no diff captured"
            }
            icon={<FileCode2 className="h-4 w-4" />}
          />
          <Mini
            label="Actions"
            value={String(actions.length)}
            sub={`${actions.filter((a) => a.decision === "deny").length} denied · ${
              actions.filter((a) => a.decision === "ask").length
            } asked`}
            icon={<Terminal className="h-4 w-4" />}
          />
          <Mini
            label="Memory cards"
            value={String(mergedCards.length)}
            sub={mergedCards.length > 0 ? "Generated by CLōD" : "none yet"}
            icon={<Brain className="h-4 w-4" />}
          />
          <Mini
            label="Status"
            value={bundle.status || "—"}
            sub={bundle.finishedAt ? `Finished ${formatRelative(bundle.finishedAt)}` : "in progress"}
            icon={<Sparkles className="h-4 w-4" />}
          />
        </div>

        {/* Tabs */}
        <div className="mt-8 flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.02] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                tab === t.id ? "text-white" : "text-white/65 hover:text-white"
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="session-tab"
                  className="absolute inset-0 rounded-full bg-gradient-to-b from-[#c47bff] to-[#7e14ff]"
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-6">
          {tab === "overview" && <OverviewTab file={file} cards={mergedCards} />}
          {tab === "actions" && <ActionsTab actions={actions} />}
          {tab === "report" && <ReportTab report={report} />}
          {tab === "memory" && (
            <div>
              {mergedCards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-white/55">
                  No memory cards generated yet for this session. Run{" "}
                  <span className="font-mono text-white/75">POST /api/import-session</span> with the
                  session file path to generate them.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {mergedCards.map((c, i) => (
                    <MemoryCardItem key={c.id} card={c} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "trace" && <TraceTab trace={bundle.agentTrace} diff={bundle.diff} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- */

function Mini({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  icon: React.ReactNode;
}) {
  const accent = "var(--color-electric)";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)] p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/45">
        <span className="flex items-center gap-1.5">
          <span style={{ color: accent }}>{icon}</span> {label}
        </span>
      </div>
      <div className="mt-2 font-serif text-[28px] leading-none text-white">{value}</div>
      <div className="mt-1 text-[11.5px] text-white/55">{sub}</div>
    </div>
  );
}

/* ------------------------- Overview tab ------------------------- */

function OverviewTab({
  file,
  cards,
}: {
  file: ApiSessionFile;
  cards: ReturnType<typeof adaptMemoryCard>[];
}) {
  const bundle = file.evidenceBundle;
  const report = file.report ?? {};
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)] p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-30 blur-3xl"
              style={{ background: "var(--color-acid)" }}
            />
            <Badge tone="acid" className="mb-3">
              <AlertOctagon className="h-3 w-3" /> Summary
            </Badge>
            <h3 className="font-serif text-[22px] leading-tight text-white md:text-[26px]">
              {report.summary || bundle.task || "—"}
            </h3>
            {bundle.repoPath && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11.5px] text-white/85">
                <FileCode2 className="h-3.5 w-3.5 text-[color:var(--color-electric)]" />
                {bundle.repoPath}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-[color:var(--color-surface)] p-6"
        >
          <Badge tone="electric" className="mb-3">
            <FileCode2 className="h-3 w-3" /> Files changed
          </Badge>
          {bundle.changedFiles && bundle.changedFiles.length > 0 ? (
            <ul className="space-y-1">
              {bundle.changedFiles.slice(0, 12).map((f) => (
                <li key={f} className="truncate font-mono text-[12px] text-white/85">
                  {f}
                </li>
              ))}
              {bundle.changedFiles.length > 12 && (
                <li className="text-[11px] text-white/45">
                  + {bundle.changedFiles.length - 12} more
                </li>
              )}
            </ul>
          ) : (
            <div className="text-[12.5px] text-white/55">
              No file changes captured for this session.
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)]"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
            <Badge tone="muted">Observed facts</Badge>
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/35">
              from report
            </span>
          </div>
          <div className="px-5 py-4">
            {report.observedFacts && report.observedFacts.length > 0 ? (
              <ul className="space-y-2">
                {report.observedFacts.map((f, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-white/85"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[12.5px] text-white/55">No observed facts captured.</div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)]"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
            <Badge tone="warn">Agent claims</Badge>
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/35">
              unverified
            </span>
          </div>
          <div className="px-5 py-4">
            {report.agentReportedClaims && report.agentReportedClaims.length > 0 ? (
              <ul className="space-y-2">
                {report.agentReportedClaims.map((c, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-white/85"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[12.5px] text-white/55">No agent-reported claims.</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Inline preview of memory cards */}
      <div>
        <h3 className="font-serif text-[22px] text-white">Generated memories</h3>
        {cards.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/45">
            No cards generated yet for this session.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {cards.slice(0, 4).map((c, i) => (
              <MemoryCardItem key={c.id} card={c} index={i} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Actions tab ------------------------- */

function ActionsTab({ actions }: { actions: ApiAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-white/55">
        No actions recorded for this session.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)]/70">
      <ul className="divide-y divide-white/5">
        {actions.map((a, i) => (
          <ActionRow key={a.action_id} action={a} index={i} />
        ))}
      </ul>
    </div>
  );
}

function decisionTone(d: "allow" | "ask" | "deny") {
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

function ActionRow({ action, index }: { action: ApiAction; index: number }) {
  const tone = decisionTone(action.decision);
  const SourceIcon = action.source === "agent" ? Bot : UserIcon;
  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="grid grid-cols-1 gap-3 px-5 py-3 lg:grid-cols-[110px_1fr_auto] lg:items-center"
    >
      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
          style={{
            color: tone.text,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
          }}
        >
          <tone.Icon className="h-3 w-3" /> {action.decision}
        </span>
      </div>
      <div className="min-w-0">
        <code className="block truncate font-mono text-[13px] text-white">{action.command}</code>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-white/45">
          {action.matched_rule && (
            <span className="font-mono">matched: {action.matched_rule}</span>
          )}
          {action.reason && (
            <>
              <span>·</span>
              <span>{action.reason}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11.5px] text-white/55 lg:justify-end">
        <span className="inline-flex items-center gap-1">
          <SourceIcon className="h-3 w-3 text-white/45" />
          {action.source || "user"}
        </span>
        <span className="inline-flex items-center gap-1">
          {action.executed ? `exit ${action.exit_code ?? 0}` : "blocked"}
        </span>
        <span className="font-mono text-[11px]">
          {new Date(action.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>
    </motion.li>
  );
}

/* ------------------------- Report tab ------------------------- */

function ReportTab({ report }: { report: ApiSessionFile["report"] }) {
  const sections: { label: string; tone: "muted" | "warn" | "electric"; items?: string[] }[] = [
    { label: "Observed facts", tone: "muted", items: report.observedFacts },
    { label: "Agent reported claims", tone: "warn", items: report.agentReportedClaims },
    { label: "Inferred hypotheses", tone: "electric", items: report.inferredHypotheses },
  ];

  return (
    <div className="space-y-4">
      {report.summary && (
        <div className="rounded-2xl border border-white/10 bg-[color:var(--color-surface)] p-5">
          <Badge tone="acid" className="mb-3">
            <AlertOctagon className="h-3 w-3" /> Summary
          </Badge>
          <p className="text-[14px] leading-relaxed text-white/85">{report.summary}</p>
        </div>
      )}
      {sections.map((s) => (
        <div
          key={s.label}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)]"
        >
          <div className="border-b border-white/5 px-5 py-3">
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          <div className="px-5 py-4">
            {s.items && s.items.length > 0 ? (
              <ul className="space-y-2">
                {s.items.map((item, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-white/85"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[12.5px] text-white/55">No entries.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------- Trace tab ------------------------- */

function TraceTab({ trace, diff }: { trace?: string; diff?: string }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)]">
        <div className="border-b border-white/5 px-5 py-3">
          <Badge tone="muted">agent-trace.md</Badge>
        </div>
        {trace ? (
          <pre className="m-0 max-h-[480px] overflow-auto px-5 py-4 font-mono text-[12px] leading-[1.6] text-white/80">
            {trace}
          </pre>
        ) : (
          <div className="px-5 py-6 text-[12.5px] text-white/55">No agent trace captured.</div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-surface)]">
        <div className="border-b border-white/5 px-5 py-3">
          <Badge tone="muted">git diff</Badge>
        </div>
        {diff ? (
          <pre className="m-0 max-h-[480px] overflow-auto px-5 py-4 font-mono text-[12px] leading-[1.6] text-white/80">
            {diff}
          </pre>
        ) : (
          <div className="px-5 py-6 text-[12.5px] text-white/55">No diff captured.</div>
        )}
      </div>
    </div>
  );
}
