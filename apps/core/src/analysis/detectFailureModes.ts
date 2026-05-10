import { ActionEvent } from "../types";

const FAILURE_PATTERNS: { pattern: RegExp; mode: string }[] = [
  { pattern: /docs?.*mismatch|mismatch.*docs?/i, mode: "docs_source_mismatch" },
  { pattern: /migration|schema/i, mode: "database_migration" },
  { pattern: /timeout|timed out/i, mode: "timeout" },
  { pattern: /permission denied|EACCES/i, mode: "permission_error" },
  { pattern: /cannot find module|module not found/i, mode: "missing_dependency" },
  { pattern: /type error|TypeError/i, mode: "type_error" },
  { pattern: /syntax error|SyntaxError/i, mode: "syntax_error" },
  { pattern: /expected.*received|assert.*fail/i, mode: "assertion_failure" },
];

export function detectFailureModes(actions: ActionEvent[]): string[] {
  const modes = new Set<string>();

  for (const action of actions) {
    if (!action.executed || (action.exit_code ?? 0) === 0) continue;
    const output = `${action.stdout ?? ""} ${action.stderr ?? ""}`;
    for (const { pattern, mode } of FAILURE_PATTERNS) {
      if (pattern.test(output)) {
        modes.add(mode);
      }
    }
    if (modes.size === 0) {
      modes.add("unknown_failure");
    }
  }

  return Array.from(modes);
}
