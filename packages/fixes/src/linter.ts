/** @format */

import { runInDocker } from "@rift/docker";
import type { Failure } from "@rift/types";

export interface LinterResult {
  fixedCount: number;
  stdout: string;
}

/**
 * Runs autopep8 --in-place to fix whitespace/indentation issues.
 * Targets INDENTATION and LINTING failures specifically.
 * Falls back gracefully — a non-zero exit just means nothing changed.
 */
export async function runLinterFix(
  workspacePath: string,
  failures: Failure[],
): Promise<LinterResult> {
  const targetTypes = new Set(["LINTING", "INDENTATION"]);
  const targetFiles = [
    ...new Set(
      failures.filter((f) => targetTypes.has(f.bugType)).map((f) => f.file),
    ),
  ];

  if (targetFiles.length === 0) {
    return { fixedCount: 0, stdout: "" };
  }

  // autopep8 --aggressive --aggressive handles most E1xx/E2xx/W codes
  const fileArgs = targetFiles.map((f) => `"${f}"`).join(" ");
  const result = await runInDocker({
    workspacePath,
    command: `autopep8 --in-place --aggressive --aggressive ${fileArgs} 2>&1`,
  });

  return {
    fixedCount: result.exitCode === 0 ? targetFiles.length : 0,
    stdout: result.stdout,
  };
}
