import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { GitCompare, Lightbulb, Brain, ArrowRight } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { useLiveSessions } from "../lib/useApi";

/**
 * Assumption-shift detection isn't wired into the backend yet — there is no
 * `/api/assumptions` route. Per the user instruction, instead of inventing
 * data we render an explicit empty state that explains exactly what would
 * power this page once the analysis layer is plugged in.
 */
export function AssumptionsPage() {
  const { data: sessions } = useLiveSessions();

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div>
          <Badge tone="warn" className="mb-3">
            <GitCompare className="h-3 w-3" /> assumption shift detection
          </Badge>
          <h1 className="font-serif text-[36px] leading-tight text-white text-balance md:text-[48px]">
            Every time the truth moved, we'd notice.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-white/60">
            When an agent's initial assumption gets contradicted by tests, code review or runtime
            evidence, this page will show both sides plus the trigger that flipped them. It's
            sourced from the analysis layer that runs over each finished session.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-10 overflow-hidden rounded-2xl border border-dashed border-white/15 bg-[color:var(--color-surface)]/60 p-8 text-center"
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <Lightbulb className="h-6 w-6 text-[color:var(--color-acid)]" />
          </div>
          <h2 className="mt-5 font-serif text-[24px] text-white">
            No assumption shifts to display.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            The backend doesn't expose an{" "}
            <span className="font-mono text-white/75">/api/assumptions</span> route yet. Once the
            analysis layer over <span className="font-mono text-white/75">@blackbox/core</span> is
            wired through, every session's assumption deltas will land here.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/sessions"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 text-[13px] text-white hover:border-white/30"
            >
              <Brain className="h-3.5 w-3.5 text-[color:var(--color-violet-glow)]" />
              {sessions.length} recorded session{sessions.length === 1 ? "" : "s"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/memories"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 text-[13px] text-white hover:border-white/30"
            >
              Browse memory cards
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-[12px] text-white/50">
          <span className="font-mono text-white/65">backend hook needed:</span>{" "}
          <span className="font-mono">GET /api/assumptions</span> · returns
          <span className="font-mono"> AssumptionShift[]</span> derived from session diff +
          analysis output.
        </div>
      </div>
    </div>
  );
}
