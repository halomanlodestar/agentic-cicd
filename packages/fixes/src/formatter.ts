/** @format */

import { runInDocker } from "@rift/docker";

export interface FormatterResult {
  reformattedFiles: string[];
  stdout: string;
}

/**
 * Runs `black .` inside Docker to auto-format all Python files.
 * black always exits 0 on success (even if it reformats), non-zero on error.
 */
export async function runFormatter(
  workspacePath: string,
): Promise<FormatterResult> {
  const result = await runInDocker({
    workspacePath,
    command: "black . 2>&1",
  });

  // Parse which files black reformatted: "reformatted path/to/file.py"
  const reformattedFiles: string[] = [];
  for (const line of result.stdout.split("\n")) {
    const m = /^reformatted\s+(.+)$/.exec(line.trim());
    if (m) reformattedFiles.push(m[1].trim());
  }

  return { reformattedFiles, stdout: result.stdout };
}
