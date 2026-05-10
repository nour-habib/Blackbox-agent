import { EvidenceBundle, DebugReport } from "../types";
import { buildObservedClaims, buildAgentReportedClaims, buildInferredClaims } from "./buildClaims";
import { detectFailureModes } from "./detectFailureModes";
import { recommendAmendments } from "./recommendAmendments";
import { generateMemoryCards } from "../memory/generateMemories";
import { summarizeWithClod, inferHypothesesWithClod } from "../sponsors/clod";
import { enrichDiffWithGreptile } from "../sponsors/greptile";

export async function analyzeBundle(
  bundle: EvidenceBundle,
  handoffs: string[] = []
): Promise<DebugReport> {
  const [summary, llmInferences, greptileEvidence] = await Promise.all([
    summarizeWithClod(bundle, handoffs),
    inferHypothesesWithClod(bundle, handoffs),
    enrichDiffWithGreptile(bundle),
  ]);

  const enrichedBundle: EvidenceBundle = {
    ...bundle,
    diff: bundle.diff + (greptileEvidence ? `\n\n# Greptile Analysis\n${greptileEvidence}` : ""),
  };

  const observedFacts = buildObservedClaims(enrichedBundle);
  const agentReportedClaims = buildAgentReportedClaims(enrichedBundle);
  const inferredHypotheses = buildInferredClaims(enrichedBundle, llmInferences);
  const failureModes = detectFailureModes(enrichedBundle.actions);
  const recommendedContractAmendments = recommendAmendments(enrichedBundle);

  const allClaims = [...observedFacts, ...agentReportedClaims, ...inferredHypotheses];
  const memoryCards = await generateMemoryCards(enrichedBundle, allClaims, summary, handoffs);

  return {
    sessionId: (bundle.id ?? bundle.sessionId!),
    summary,
    observedFacts,
    agentReportedClaims,
    inferredHypotheses,
    failureModes,
    memoryCards,
    recommendedContractAmendments,
  };
}
