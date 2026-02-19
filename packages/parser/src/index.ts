/** @format */

import type { Failure } from "@rift/types";
import { parseFlake8 } from "./flake8";
import { parsePytest } from "./pytest";

export { parseFlake8 } from "./flake8";
export { parsePytest } from "./pytest";

/**
 * Parse both pytest and flake8 outputs into a deduplicated Failure list.
 * Deduplication key: file + line + bugType — flake8 wins over pytest for the
 * same location since it's more precise about error codes.
 */
export function parseFailures(rawPytest: string, rawFlake8: string): Failure[] {
  const flake8Failures = parseFlake8(rawFlake8);
  const pytestFailures = parsePytest(rawPytest);

  // Index flake8 by key so pytest dupes are dropped
  const seen = new Map<string, Failure>();

  for (const f of flake8Failures) {
    seen.set(dedupeKey(f), f);
  }

  for (const f of pytestFailures) {
    const key = dedupeKey(f);
    if (!seen.has(key)) {
      seen.set(key, f);
    }
  }

  return Array.from(seen.values());
}

function dedupeKey(f: Failure): string {
  return `${f.file}:${f.line}:${f.bugType}`;
}
