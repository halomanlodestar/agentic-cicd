/** @format */

import type { DockerSession } from "@rift/docker";

export interface FormatterResult {
  reformattedFiles: string[];
  stdout: string;
}

/**
 * Runs the full deterministic auto-fix chain inside the pipeline container:
 *   1. autoflake  — removes unused imports (F401) and unused variables (F841)
 *   2. black      — reformats everything, adds trailing newlines (W292), fixes spacing
 *
 * Both tools operate in-place recursively over the workspace.
 */
export async function runFormatter(
  session: DockerSession,
): Promise<FormatterResult> {
  // Step 1: autoflake — remove dead imports and assignments
  await session.exec(
    "autoflake --in-place --recursive --remove-all-unused-imports --remove-unused-variables . 2>&1",
    "autoflake",
  );

  // Step 2: black — reformat everything (also fixes W292 trailing newline)
  const result = await session.exec("black . 2>&1", "black");

  // Parse which files black reformatted: "reformatted path/to/file.py"
  const reformattedFiles: string[] = [];
  for (const line of result.stdout.split("\n")) {
    const m = /^reformatted\s+(.+)$/.exec(line.trim());
    if (m) reformattedFiles.push(m[1].trim());
  }

  return { reformattedFiles, stdout: result.stdout };
}
