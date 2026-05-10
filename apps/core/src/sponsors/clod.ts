import OpenAI from "openai";
import { EvidenceBundle, Claim, MemoryCard } from "../types";

// CLōD is OpenAI-compatible — base URL: https://api.clod.io/v1
const clod = new OpenAI({
  apiKey: process.env.CLOD_API_KEY,
  baseURL: "https://api.clod.io/v1",
});

// Free models via CLōD — no separate DeepSeek key needed
const FREE_MODEL = process.env.CLOD_FREE_MODEL ?? "deepseek/deepseek-r1-0528:free";
const STRUCTURED_MODEL = process.env.CLOD_STRUCTURED_MODEL ?? "qwen/qwen3-235b-a22b:free";

async function complete(model: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await clod.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// Free model: simple summarization
export async function summarizeWithClod(bundle: EvidenceBundle): Promise<string> {
  const prompt = `Summarize this software development session in 2-3 sentences.

Task: ${bundle.task}
Changed files: ${bundle.changedFiles.join(", ")}
Commands run: ${bundle.actions.map((a) => `${a.command} (exit ${a.exit_code ?? "?"}, ${a.decision})`).join(", ")}
Agent trace excerpt: ${bundle.agentTrace.slice(0, 500)}
Diff excerpt: ${bundle.diff.slice(0, 1000)}

Respond with only the summary text.`;

  return complete(FREE_MODEL, prompt, 256);
}

// Free model: pattern inference
export async function inferHypothesesWithClod(bundle: EvidenceBundle): Promise<string[]> {
  const prompt = `Analyze this software session and list up to 3 non-obvious inferred hypotheses about root causes or patterns. Each on its own line, no bullet points. Respond empty if none.

Task: ${bundle.task}
Changed files: ${bundle.changedFiles.join(", ")}
Failed commands: ${bundle.actions
    .filter((a) => a.executed && (a.exit_code ?? 0) !== 0)
    .map((a) => `"${a.command}": ${(a.stdout ?? a.stderr ?? "").slice(0, 200)}`)
    .join("\n")}
Agent trace: ${bundle.agentTrace.slice(0, 800)}
Diff: ${bundle.diff.slice(0, 1500)}`;

  const text = await complete(FREE_MODEL, prompt, 512);
  if (!text) return [];
  return text.split("\n").filter(Boolean).slice(0, 3);
}

// Structured model: memory card generation needs reliable JSON output
export async function generateMemoryCardsWithClod(
  bundle: EvidenceBundle,
  claims: Claim[],
  summary: string
): Promise<MemoryCard[]> {
  const prompt = `Generate 1-5 memory cards from this software session as a JSON array. Each card captures a reusable insight.

Session summary: ${summary}
Task: ${bundle.task}
Changed files: ${bundle.changedFiles.join(", ")}
Claims:
${claims.map((c) => `- [${c.kind}] ${c.text}`).join("\n")}

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
    id: `memory_${bundle.sessionId}_${i}`,
    sessionId: bundle.sessionId,
    isStale: false,
    createdAt: new Date().toISOString(),
  }));
}
