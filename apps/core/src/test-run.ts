import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { importSession } from "./db/importSession";
import { getContextForTask } from "./memory/getContextForTask";
import { runStaleCheck } from "./memory/runStaleCheck";

const REAL_SESSION = process.argv[2] ?? path.resolve(__dirname, "../mock/session.example.json");
const WITSMITH_DIR = process.argv[3] ?? path.resolve(__dirname, "../mock");

async function main() {
  console.log("--- Step 1: Import real CLI session ---");
  const cards = await importSession(REAL_SESSION);
  console.log(`Generated ${cards.length} memory card(s):`);
  for (const card of cards) {
    console.log(`  [${card.type}] ${card.content.slice(0, 80)}...`);
  }

  console.log("\n--- Step 2: Get context for a new task ---");
  const result = await getContextForTask(
    { task: "Add refresh-token validation", limit: 3 },
    WITSMITH_DIR
  );
  console.log("Context block:\n", result.contextBlock);

  console.log("\n--- Step 3: Stale check ---");
  const stale = await runStaleCheck(process.cwd());
  console.log(`Checked ${stale.checked} memories, ${stale.staleCount} stale.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
