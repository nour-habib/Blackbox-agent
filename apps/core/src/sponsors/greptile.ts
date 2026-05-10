import { EvidenceBundle } from "../types";

// Greptile sponsor integration — codebase-aware diff review and evidence enrichment
// Docs: https://docs.greptile.com
// Used to enrich evidence in Claims before memory card generation

const GREPTILE_API_URL = "https://api.greptile.com/v2";

export async function enrichDiffWithGreptile(bundle: EvidenceBundle): Promise<string | null> {
  const apiKey = process.env.GREPTILE_API_KEY;

  if (!apiKey) {
    console.warn("[greptile] GREPTILE_API_KEY not set, skipping diff enrichment");
    return null;
  }

  try {
    const response = await fetch(`${GREPTILE_API_URL}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Review this git diff from a session fixing: "${bundle.task}".
Identify:
1. Risks introduced
2. Coding conventions this may violate
3. Any codebase-specific context that's relevant

Diff:
${bundle.diff.slice(0, 3000)}`,
          },
        ],
        repositories: [
          {
            remote: "github",
            repository: bundle.repoPath,
            branch: bundle.branch,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[greptile] API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { message?: string };
    return data.message ?? null;
  } catch (err) {
    console.warn("[greptile] Request failed, skipping:", err);
    return null;
  }
}
