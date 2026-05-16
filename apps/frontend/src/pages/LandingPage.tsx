import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  ShieldCheck,
  Brain,
  Eye,
} from "lucide-react";
import { HeroBackdrop } from "../components/ui/HeroBackdrop";
import { OrbitalCenterpiece } from "../components/ui/OrbitalCenterpiece";
import { LinkButton } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SponsorBadge } from "../components/ui/SponsorBadge";
import { sponsorMeta, type SponsorTag } from "../lib/display";
import { useApiHealth, useLiveSessions } from "../lib/useApi";

/**
 * Landing page — redesigned to be lighter and more focused.
 *
 * From v1's eight sections we keep four:
 *   1. HERO with the orbital centerpiece (signature animation)
 *   2. Three pillars (gate / record / remember) — what witsmith does
 *   3. The flow in three concise steps
 *   4. Final CTA + footer
 *
 * Sponsor strip moves into the hero. Metrics/Demo timelines/Assumption
 * teaser live on their dedicated pages now.
 */
export function LandingPage() {
  return (
    <div className="relative">
      <HeroSection />
      <PillarsSection />
      <FlowSection />
      <FinalCTA />
    </div>
  );
}

/* ------------------------- Hero ------------------------- */

function HeroSection() {
  const { live, checking } = useApiHealth();
  const { data: sessions } = useLiveSessions();
  const sessionCount = sessions.length;

  return (
    <section className="relative px-6 pb-20 pt-12 md:pt-16">
      <HeroBackdrop />

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-white/70 backdrop-blur"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{
                  background: live
                    ? "var(--color-success)"
                    : checking
                    ? "var(--color-violet-glow)"
                    : "var(--color-danger)",
                }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{
                  background: live
                    ? "var(--color-success)"
                    : checking
                    ? "var(--color-violet-glow)"
                    : "var(--color-danger)",
                }}
              />
            </span>
            <span>{checking ? "checking backend…" : live ? "backend online" : "backend offline"}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/50">
              {sessionCount > 0
                ? `${sessionCount} recorded session${sessionCount === 1 ? "" : "s"}`
                : "no sessions yet"}
            </span>
          </motion.div>

          <h1 className="mt-6 font-serif text-[44px] leading-[1.04] tracking-tight text-white text-balance md:text-[68px]">
            See <em className="not-italic gradient-text-acid">why</em> your AI agent
            <br className="hidden md:block" /> did what it did.
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/65 lg:mx-0"
          >
            Witsmith gates risky commands, records every coding-agent session, and turns
            each finished run into memory your next agent can actually use.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <LinkButton size="lg" href="/sessions" iconRight={<ArrowRight className="h-4 w-4" />}>
              Open the dashboard
            </LinkButton>
            <Link to="/cli">
              <span className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 font-mono text-[13px] text-white/85 backdrop-blur transition-colors hover:border-[color:var(--color-violet-glow)]/40 hover:bg-white/[0.05]">
                <span className="text-[color:var(--color-violet-glow)]">$</span>
                <span>witsmith start "fix oauth bug"</span>
              </span>
            </Link>
          </motion.div>

          {/* sponsor strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col items-center gap-2.5 lg:items-start"
          >
            <span className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-[color:var(--color-dim)]">
              built with
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              {(Object.keys(sponsorMeta) as SponsorTag[]).map((s) => (
                <SponsorBadge key={s} tag={s} />
              ))}
            </div>
          </motion.div>
        </div>

        {/* THE CENTERPIECE — orbital floating icons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center"
        >
          <OrbitalCenterpiece />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------- Three pillars ------------------------- */

const pillars = [
  {
    icon: ShieldCheck,
    eyebrow: "01 · gate",
    title: "Gate every command.",
    desc:
      "AGENT_WIT.yaml decides allow, ask, or deny on every command an agent runs — before it touches your repo.",
    href: "/safety",
    accent: "var(--color-violet-glow)",
  },
  {
    icon: Eye,
    eyebrow: "02 · record",
    title: "Record the whole run.",
    desc:
      "Diffs, commands, exit codes, test output, file hashes — packaged into one replayable session JSON.",
    href: "/sessions",
    accent: "var(--color-electric)",
  },
  {
    icon: Brain,
    eyebrow: "03 · remember",
    title: "Hand the next agent the lesson.",
    desc:
      "Each session distills into memory cards your next agent retrieves — and re-verifies when the source moves.",
    href: "/memories",
    accent: "var(--color-acid-soft)",
  },
];

function PillarsSection() {
  return (
    <section className="border-t border-white/5 bg-[color:var(--color-bg-soft)]/40 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="violet" className="mb-3">three things, that's it</Badge>
          <h2 className="font-serif text-[32px] leading-tight text-white text-balance md:text-[42px]">
            Gate. Record. Remember.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14.5px] text-white/55">
            Witsmith is a thin layer that lives next to your repo. It does three things and
            does them quietly.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="elev-1 group relative h-full overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/80 p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-violet-glow)]/35"
            >
              <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-dim)]">
                {p.eyebrow}
              </div>
              <div
                className="mt-4 grid h-11 w-11 place-items-center rounded-xl border"
                style={{
                  background: `color-mix(in oklab, ${p.accent} 10%, transparent)`,
                  borderColor: `color-mix(in oklab, ${p.accent} 32%, transparent)`,
                }}
              >
                <p.icon className="h-4.5 w-4.5" style={{ color: p.accent }} />
              </div>
              <h3 className="mt-4 font-serif text-[22px] leading-tight text-white">
                {p.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{p.desc}</p>
              <Link
                to={p.href}
                className="mt-5 inline-flex items-center gap-1 text-[12.5px] text-white/70 transition-colors hover:text-[color:var(--color-violet-glow)]"
              >
                Explore <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- Flow (concise) ------------------------- */

const flow = [
  {
    label: "init",
    cmd: "witsmith init",
    desc: "Drops AGENT_WIT.yaml + .witsmith/ into your repo.",
  },
  {
    label: "record",
    cmd: "witsmith start \"task\"",
    desc: "Snapshot, then your agent runs as usual. We stay out of the way.",
  },
  {
    label: "hand off",
    cmd: "witsmith finish",
    desc: "Diff + commands + memory cards land in one session JSON.",
  },
];

function FlowSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="acid" className="mb-3">the loop</Badge>
          <h2 className="font-serif text-[30px] leading-tight text-white text-balance md:text-[38px]">
            Three commands, every session.
          </h2>
        </div>

        <div className="relative mt-12 grid gap-4 md:grid-cols-3">
          {/* connector line — single soft gradient instead of multi-orb glows */}
          <div
            aria-hidden
            className="absolute left-[8%] right-[8%] top-[34px] hidden h-px md:block"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(170,59,255,0.45) 18%, rgba(71,191,255,0.45) 82%, transparent 100%)",
            }}
          />

          {flow.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative grid h-[68px] w-[68px] place-items-center rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] backdrop-blur">
                <span className="font-serif text-[28px] text-[color:var(--color-violet-glow)]">
                  {i + 1}
                </span>
              </div>
              <div className="mt-4 font-serif text-[18px] text-white">{step.label}</div>
              <code className="mt-1 inline-block rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-[11.5px] text-[color:var(--color-violet-glow)]">
                {step.cmd}
              </code>
              <p className="mt-3 max-w-[220px] text-[12.5px] leading-relaxed text-white/55">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- Final CTA ------------------------- */

function FinalCTA() {
  return (
    <section className="px-6 pb-24 pt-8">
      <div className="elev-2 relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-10 py-14 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[640px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(170,59,255,0.32), transparent)" }}
        />
        <div className="absolute inset-0 dot-grid opacity-30 mask-fade-b" aria-hidden />

        <div className="relative">
          <h2 className="font-serif text-[36px] leading-tight text-white text-balance md:text-[50px]">
            Stop guessing. Start replaying.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] text-white/60">
            Drop the CLI in any repo. Your next agent run will already know what your last
            one learned.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <LinkButton size="lg" href="/sessions" iconRight={<ArrowRight className="h-4 w-4" />}>
              Open dashboard
            </LinkButton>
            <LinkButton size="lg" variant="outline" href="/cli">
              Browse CLI
            </LinkButton>
          </div>
        </div>
      </div>

      <footer className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-6 text-[12px] text-[color:var(--color-dim)]">
        <span>© 2026 witsmith · agent safety + memory.</span>
        <div className="flex items-center gap-3 text-white/55">
          {[
            { id: "github-icon",        title: "github" },
            { id: "documentation-icon", title: "docs" },
            { id: "discord-icon",       title: "discord" },
            { id: "x-icon",             title: "x" },
            { id: "bluesky-icon",       title: "bluesky" },
          ].map((g) => (
            <a
              key={g.id}
              href="#"
              title={g.title}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.06] hover:border-[color:var(--color-violet-glow)]/40 hover:bg-white/[0.04]"
            >
              <svg width="14" height="14" aria-hidden>
                <use href={`/icons.svg#${g.id}`} />
              </svg>
            </a>
          ))}
        </div>
        <span className="font-mono">v0.1.0 · demo</span>
      </footer>
    </section>
  );
}
