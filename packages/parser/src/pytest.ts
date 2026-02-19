/** @format */

import type { BugType, Failure } from "@rift/types";

// ─── Pytest --tb=short output patterns ───────────────────────────────────────
//
// FAILED tests/test_utils.py::TestUtils::test_add - AssertionError: ...
// ERROR tests/test_utils.py::TestUtils::test_add - ImportError: ...
//
// Short traceback block:
// tests/test_utils.py:42: AssertionError
// tests/test_utils.py:10: in test_add
//   result = utils.add(1, "two")

const FAILED_RE = /^(?:FAILED|ERROR)\s+(.+?)(?:\s+-\s+(.+))?$/;
const TRACEBACK_FILE_RE = /^(.+?):(\d+):\s+(.*)$/;

interface PytestFailedEntry {
  testId: string;
  errorSummary: string;
  tracebackLines: string[];
}

function classifyPytestError(
  errorSummary: string,
  tracebackText: string,
): BugType {
  const combined = (errorSummary + " " + tracebackText).toLowerCase();

  if (
    combined.includes("importerror") ||
    combined.includes("modulenotfounderror") ||
    combined.includes("cannot import")
  )
    return "IMPORT";

  if (combined.includes("typeerror") || combined.includes("type error"))
    return "TYPE_ERROR";

  if (
    combined.includes("syntaxerror") ||
    combined.includes("indentationerror") ||
    combined.includes("unexpected indent") ||
    combined.includes("unexpected eof")
  )
    return "SYNTAX";

  if (combined.includes("indentation")) return "INDENTATION";

  return "LOGIC";
}

/**
 * Extract a source file + line from a pytest traceback block.
 * Returns the last "real" file reference (not site-packages).
 */
function extractSourceLocation(
  tracebackLines: string[],
  testId: string,
): { file: string; line: number } {
  // Prefer the innermost user-code file (not site-packages / _pytest internals)
  const candidates: { file: string; line: number }[] = [];

  for (const line of tracebackLines) {
    const m = TRACEBACK_FILE_RE.exec(line.trim());
    if (!m) continue;
    const [, file, lineStr] = m;
    if (
      file.includes("site-packages") ||
      file.includes("_pytest") ||
      file.startsWith("<")
    )
      continue;
    candidates.push({ file: file.trim(), line: parseInt(lineStr, 10) });
  }

  if (candidates.length > 0) return candidates[candidates.length - 1];

  // Fallback: parse file from testId like "tests/test_utils.py::TestX::test_y"
  const parts = testId.split("::");
  const file = parts[0];
  return { file, line: 1 };
}

/**
 * Parse raw pytest --tb=short output into typed Failure objects.
 */
export function parsePytest(raw: string): Failure[] {
  const lines = raw.split("\n");
  const failures: Failure[] = [];

  // Collect FAILED/ERROR header lines + their traceback blocks
  const entries: PytestFailedEntry[] = [];
  let currentEntry: PytestFailedEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const failedMatch = FAILED_RE.exec(trimmed);
    if (failedMatch) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        testId: failedMatch[1].trim(),
        errorSummary: failedMatch[2]?.trim() ?? "",
        tracebackLines: [],
      };
      continue;
    }

    if (currentEntry) {
      // Stop collecting on blank separator lines or summary lines
      if (trimmed.startsWith("=====") || trimmed.startsWith("-----")) {
        entries.push(currentEntry);
        currentEntry = null;
        continue;
      }
      currentEntry.tracebackLines.push(line);
    }
  }
  if (currentEntry) entries.push(currentEntry);

  for (const entry of entries) {
    const tracebackText = entry.tracebackLines.join("\n");
    const bugType = classifyPytestError(entry.errorSummary, tracebackText);
    const { file, line } = extractSourceLocation(
      entry.tracebackLines,
      entry.testId,
    );

    failures.push({
      file,
      line,
      bugType,
      message: entry.errorSummary || entry.testId,
    });
  }

  return failures;
}
