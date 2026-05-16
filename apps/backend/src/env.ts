/**
 * Loads env BEFORE any other module is imported.
 *
 * @blackbox/core eagerly instantiates an OpenAI client + opens a Prisma
 * connection at module load using process.env.{CLOD_API_KEY,DATABASE_URL}.
 * We must populate env vars before that import fires.
 *
 * Load order (first wins, override:false on later passes):
 *   1. apps/backend/.env           — backend-specific overrides
 *   2. monorepo root .env          — shared keys (CLOD_API_KEY, NIA_API_KEY)
 *
 * We then force DATABASE_URL to an absolute path so Prisma doesn't try to
 * resolve a relative `file:` URL from its schema directory, which would
 * point at the wrong location when the backend is the consumer.
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
  override: false,
});

// __dirname here is apps/backend/src (tsx) or apps/backend/dist (built).
// Three levels up lands at the monorepo root in both cases.
const repoRoot = path.resolve(__dirname, "../../..");
const dbAbs = path.resolve(repoRoot, "apps/core/prisma/witsmith.db");
process.env.DATABASE_URL = `file:${dbAbs.replace(/\\/g, "/")}`;
