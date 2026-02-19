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
    const msg = failure.message.toLowerCase();
    const isUnusedImport =
      msg.includes("imported but unused") ||
      msg.includes("unused import") ||
      msg.includes("f401");
    const isDeadAssignment =
      msg.includes("assigned to but never used") || msg.includes("f841");

    if (!isUnusedImport && !isDeadAssignment) continue;

    const filePath = join(workspacePath, failure.file);
    try {
      const content = await readFile(filePath, "utf8");
      const lines = content.split("\n");
      const targetLine = failure.line - 1; // 0-indexed

      if (targetLine < 0 || targetLine >= lines.length) continue;
      const line = lines[targetLine];

      if (isUnusedImport) {
        // Only remove if this line is actually an import statement
        if (/^\s*(import|from)\s+/.test(line)) {
          lines.splice(targetLine, 1);
          await writeFile(filePath, lines.join("\n"), "utf8");
          fixedFiles.add(failure.file);
        }
      } else if (isDeadAssignment) {
        // var = expr  →  strip the "var =" part if RHS is a call (keep side effects)
        //             →  remove the line entirely if RHS is a literal
        const assignMatch = /^(\s*)\w+\s*=\s*(.+)$/.exec(line);
        if (assignMatch) {
          const [, indent, rhs] = assignMatch;
          if (/\(/.test(rhs)) {
            // RHS has a call — keep it as a standalone expression
            lines[targetLine] = `${indent}${rhs.trimEnd()}`;
          } else {
            // Pure literal/name — remove the whole line
            lines.splice(targetLine, 1);
          }
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
