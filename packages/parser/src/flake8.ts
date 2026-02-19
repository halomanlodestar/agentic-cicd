/** @format */

import type { BugType, Failure } from "@rift/types";

// ─── flake8 default format: path/file.py:line:col: CODE message ──────────────
// E.g.: src/utils.py:15:1: F401 'os' imported but unused
// E.g.: src/validator.py:8:10: E228 missing whitespace around modulo operator

const LINE_RE = /^(.+?):(\d+):\d+:\s+([EWF]\d+)\s+(.+)$/;

/**
 * Map a flake8 error/warning code to our BugType.
 * Reference: https://flake8.pycqa.org/en/latest/user/error-codes.html
 */
function codeToBugType(code: string, message: string): BugType {
  const prefix = code.slice(0, 2); // E1, W2, F4, etc.
  const n = parseInt(code.slice(1), 10);

  // F401 = imported but unused, F811 = redefined unused import
  if (code === "F401" || code === "F811") return "LINTING";

  // E1xx / W1xx = indentation
  if (prefix === "E1" || prefix === "W1") return "INDENTATION";

  // E2xx = whitespace (treat as linting)
  if (prefix === "E2") return "LINTING";

  // E3xx = blank line (linting)
  if (prefix === "E3") return "LINTING";

  // E4xx = imports
  if (prefix === "E4") return "IMPORT";

  // E5xx = line length (linting)
  if (prefix === "E5") return "LINTING";

  // E7xx = statement errors (syntax-adjacent)
  if (prefix === "E7") return "SYNTAX";

  // E9xx = runtime/syntax errors
  if (prefix === "E9") return "SYNTAX";

  // W6xx = deprecated features
  if (prefix === "W6") return "SYNTAX";

  // F8xx = undefined name / import errors
  if (n >= 800 && n < 900 && code.startsWith("F")) return "IMPORT";

  // W2xx/W3xx = whitespace warnings
  if (prefix === "W2" || prefix === "W3") return "LINTING";

  // Keyword in message heuristics
  if (message.toLowerCase().includes("import")) return "IMPORT";
  if (message.toLowerCase().includes("indent")) return "INDENTATION";
  if (message.toLowerCase().includes("syntax")) return "SYNTAX";

  return "LINTING";
}

/**
 * Parse raw flake8 stdout into typed Failure objects.
 */
export function parseFlake8(raw: string): Failure[] {
  const failures: Failure[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = LINE_RE.exec(trimmed);
    if (!match) continue;

    const [, file, lineStr, code, message] = match;
    failures.push({
      file: file.trim(),
      line: parseInt(lineStr, 10),
      bugType: codeToBugType(code, message),
      message: `${code} ${message.trim()}`,
    });
  }

  return failures;
}
