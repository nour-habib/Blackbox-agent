import { MemoryCard } from "../types";

// Nia by Nozomio — semantic retrieval layer
// SDK: @nozomioai/nia (installed globally via nia-wizard)
// Docs: https://docs.trynia.ai/api-guide

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let niaClient: any = null;

async function getNiaClient() {
  if (niaClient) return niaClient;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Nia } = require("@nozomioai/nia");
    niaClient = new Nia({ apiKey: process.env.NIA_API_KEY });
    return niaClient;
  } catch {
    throw new Error("@nozomioai/nia not installed. Run: npx nia-wizard@latest");
  }
}

export async function indexMemoriesWithNia(memories: MemoryCard[]): Promise<void> {
  if (memories.length === 0) return;

  try {
    const nia = await getNiaClient();
    const documents = memories.map((m) => ({
      id: m.id,
      content: [m.content, ...m.evidence, ...m.retrieveWhen].join(" "),
      metadata: {
        sessionId: m.sessionId,
        type: m.type,
        confidence: m.confidence,
        sourceFiles: m.sourceFiles,
      },
    }));

    await nia.index(documents);
  } catch (err) {
    // Non-fatal: keyword search will be used as fallback
    console.warn("[nia] Indexing failed, keyword search will be used as fallback:", err);
  }
}

export async function queryNia(
  task: string,
  memories: MemoryCard[]
): Promise<MemoryCard[]> {
  const nia = await getNiaClient();

  const results: { id: string; score: number }[] = await nia.search(task, {
    topK: 5,
    filter: { isStale: false },
  });

  const idSet = new Set(results.map((r) => r.id));
  const ranked = results
    .map((r) => memories.find((m) => m.id === r.id))
    .filter((m): m is MemoryCard => m !== undefined && !m.isStale);

  // Append any memories not returned by Nia but still valid (fallback)
  const rest = memories.filter((m) => !idSet.has(m.id) && !m.isStale);
  return [...ranked, ...rest];
}
