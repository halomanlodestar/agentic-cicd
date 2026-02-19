/** @format */

import type { DockerSession } from "@rift/docker";

export interface FormatterResult {
  reformattedFiles: string[];
  stdout: string;
}

/**
 * Runs `black .` inside the pipeline container to auto-format all Python files.
 */
export async function runFormatter(
  session: DockerSession,
): Promise<FormatterResult> {
  const result = await session.exec("black . 2>&1");

  // Parse which files black reformatted: "reformatted path/to/file.py"
  const reformattedFiles: string[] = [];
  for (const line of result.stdout.split("\n")) {
    const m = /^reformatted\s+(.+)$/.exec(line.trim());
    if (m) reformattedFiles.push(m[1].trim());
  }

  return { reformattedFiles, stdout: result.stdout };
}
