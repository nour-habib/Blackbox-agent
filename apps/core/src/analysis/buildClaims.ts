import { Claim, EvidenceBundle } from "../types";

export function buildObservedClaims(bundle: EvidenceBundle): Claim[] {
  const claims: Claim[] = [];

  if (bundle.changedFiles.length > 0) {
    claims.push({
      id: `claim_observed_${Date.now()}_files`,
      kind: "observed",
      text: `The session changed: ${bundle.changedFiles.join(", ")}.`,
      confidence: "high",
      evidence: ["git diff --name-only"],
    });
  }

  const failedActions = bundle.actions.filter((a) => a.executed && (a.exit_code ?? 0) !== 0);
  for (const action of failedActions) {
    const output = action.stdout ?? action.stderr ?? "";
    claims.push({
      id: `claim_observed_${Date.now()}_${action.command.replace(/\s/g, "_")}`,
      kind: "observed",
      text: `Command "${action.command}" failed with exit code ${action.exit_code}.`,
      confidence: "high",
      evidence: [`command output: ${output.slice(0, 200)}`],
    });
  }

  return claims;
}

export function buildAgentReportedClaims(bundle: EvidenceBundle): Claim[] {
  if (!bundle.agentTrace) return [];

  return [
    {
      id: `claim_agent_${Date.now()}_trace`,
      kind: "agent_reported",
      text: "Agent trace was captured for this session.",
      confidence: "medium",
      evidence: [".witsmith/agent-trace.md"],
    },
  ];
}

export function buildInferredClaims(
  bundle: EvidenceBundle,
  llmInferences: string[]
): Claim[] {
  return llmInferences.map((text, i) => ({
    id: `claim_inferred_${Date.now()}_${i}`,
    kind: "inferred" as const,
    text,
    confidence: "medium" as const,
    evidence: ["llm analysis of diff and agent trace"],
  }));
}
