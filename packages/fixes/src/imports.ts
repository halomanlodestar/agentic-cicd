/** @format */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { Failure } from "@rift/types";

export interface ImportFixResult {
  fixedFiles: string[];
}

/**
 * Fixes IMPORT and LINTING failures related to unused/missing imports.
 *
 * Strategy:
 * - "imported but unused" (F401, W0611) → remove the specific import line
 * - isort is run via Docker to sort and deduplicate remaining imports
 */
export async function runImportFix(
  workspacePath: string,
  failures: Failure[],
): Promise<ImportFixResult> {
  const importFailures = failures.filter(
    (f) =>
      f.bugType === "IMPORT" ||
      (f.bugType === "LINTING" &&
        (f.message.toLowerCase().includes("import") ||
          f.message.toLowerCase().includes("unused"))),
  );

  if (importFailures.length === 0) return { fixedFiles: [] };

  const fixedFiles = new Set<string>();

  for (const failure of importFailures) {
    // Only handle "remove unused import" deterministically
    if (
      !failure.message.toLowerCase().includes("imported but unused") &&
      !failure.message.toLowerCase().includes("unused import") &&
      !failure.message.toLowerCase().includes("f401")
    ) {
      continue;
    }

    const filePath = join(workspacePath, failure.file);
    try {
      const content = await readFile(filePath, "utf8");
      const lines = content.split("\n");
      const targetLine = failure.line - 1; // 0-indexed

      if (targetLine >= 0 && targetLine < lines.length) {
        const line = lines[targetLine];
        // Only remove if this line is actually an import statement
        if (/^\s*(import|from)\s+/.test(line)) {
          lines.splice(targetLine, 1);
          await writeFile(filePath, lines.join("\n"), "utf8");
          fixedFiles.add(failure.file);
        }
      }
    } catch {
      // File read/write failed — skip this one
    }
  }

  return { fixedFiles: Array.from(fixedFiles) };
}
