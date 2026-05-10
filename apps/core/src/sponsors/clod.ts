import OpenAI from "openai";
import { EvidenceBundle, Claim, MemoryCard } from "../types";

const clod = new OpenAI({
  apiKey: process.env.CLOD_API_KEY,
  baseURL: "https://api.clod.io/v1",
});

const FAST_MODEL = process.env.CLOD_FREE_MODEL ?? "claude-haiku-4-5";
const STRUCTURED_MODEL = process.env.CLOD_STRUCTURED_MODEL ?? "claude-haiku-4-5";

async function complete(model: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await clod.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function summarizeWithClod(bundle: EvidenceBundle, handoffs: string[] = []): Promise<string> {
  const handoffSection = handoffs.length
    ? `\nHandoff notes:\n${handoffs.map((h, i) => `[${i + 1}] ${h}`).join("\n")}`
    : "";

  const prompt = `Summarize this software development session in 2-3 sentences.

Task: ${bundle.task}
Changed files: ${bundle.changedFiles.join(", ")}
Commands: ${bundle.actions.map((a) => `${a.command} (exit ${a.exit_code ?? "?"}, ${a.decision})`).join(", ")}
Trace: ${bundle.agentTrace.slice(0, 500)}
Diff: ${bundle.diff.slice(0, 1000)}${handoffSection}

Respond with only the summary text.`;

  return complete(FAST_MODEL, prompt, 256);
}

export async function inferHypothesesWithClod(bundle: EvidenceBundle, handoffs: string[] = []): Promise<string[]> {
  const handoffSection = handoffs.length
    ? `\nHandoff notes:\n${handoffs.map((h, i) => `[${i + 1}] ${h}`).join("\n")}`
    : "";

  const prompt = `List up to 3 non-obvious inferred hypotheses about root causes or patterns in this session. One per line, no bullets. Respond empty if none.

Task: ${bundle.task}
Changed files: ${bundle.changedFiles.join(", ")}
Failed commands: ${bundle.actions
    .filter((a) => a.executed && (a.exit_code ?? 0) !== 0)
    .map((a) => `"${a.command}": ${(a.stdout ?? a.stderr ?? "").slice(0, 200)}`)
    .join("\n")}
Trace: ${bundle.agentTrace.slice(0, 800)}
Diff: ${bundle.diff.slice(0, 1500)}${handoffSection}`;

  const text = await complete(FAST_MODEL, prompt, 512);
  if (!text) return [];
  return text.split("\n").filter(Boolean).slice(0, 3);
}

export async function generateMemoryCardsWithClod(
  bundle: EvidenceBundle,
  claims: Claim[],
  summary: string,
  handoffs: string[] = []
): Promise<MemoryCard[]> {
  const handoffSection = handoffs.length
    ? `\nHandoff notes (use as risk evidence):\n${handoffs.map((h, i) => `[${i + 1}] ${h}`).join("\n")}`
    : "";

  const prompt = `Generate 1-5 memory cards from this software session as a JSON array. Each card captures a reusable insight.

Summary: ${summary}
Task: ${bundle.task}
Changed files: ${bundle.changedFiles.join(", ")}
Claims:
${claims.map((c) => `- [${c.kind}] ${c.text}`).join("\n")}${handoffSection}

Each card must follow this exact schema:
{
  "type": "episodic" | "semantic" | "procedural" | "risk",
  "claimType": "observed" | "agent_reported" | "inferred",
  "content": "string",
  "evidence": ["string"],
  "sourceFiles": ["string"],
  "confidence": "low" | "medium" | "high",
  "retrieveWhen": ["keyword strings"],
  "staleIfChanged": ["file paths"]
}

Respond with only the JSON array.`;

  const raw = await complete(STRUCTURED_MODEL, prompt, 2048);

  let parsed: Omit<MemoryCard, "id" | "sessionId" | "isStale" | "createdAt">[];
  try {
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]") + 1;
    parsed = JSON.parse(raw.slice(jsonStart, jsonEnd));
  } catch {
    return [];
  }

  return parsed.map((card, i) => ({
    ...card,
    id: `memory_${(bundle.id ?? bundle.sessionId!)}_${i}`,
    sessionId: (bundle.id ?? bundle.sessionId!),
    isStale: false,
    createdAt: new Date().toISOString(),
  }));
}
