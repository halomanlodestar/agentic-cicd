/** @format */

import type { DockerSession } from "@rift/docker";
import type { Failure } from "@rift/types";

export interface LinterResult {
  fixedCount: number;
  stdout: string;
}

/**
 * Runs autopep8 --in-place inside the pipeline container.
 * Targets INDENTATION and LINTING failures specifically.
 */
export async function runLinterFix(
  session: DockerSession,
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

  const fileArgs = targetFiles.map((f) => `"${f}"`).join(" ");
  const result = await session.exec(
    `autopep8 --in-place --aggressive --aggressive ${fileArgs} 2>&1`,
  );

  return {
    fixedCount: result.exitCode === 0 ? targetFiles.length : 0,
    stdout: result.stdout,
  };
}
