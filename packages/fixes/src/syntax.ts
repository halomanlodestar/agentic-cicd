/** @format */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { Failure } from "@rift/types";

export interface SyntaxFixResult {
  fixedFiles: string[];
}

// Keywords that introduce a block and need a colon
const BLOCK_KEYWORDS_RE =
  /^(\s*)(def |class |if |elif |else|for |while |with |try|except|except |finally)\b(.*)$/;

/**
 * Applies deterministic syntax patches:
 * 1. Missing colon at end of block-opening statements (def, class, if, for, etc.)
 * 2. Strips trailing semicolons (E703)
 */
export async function runSyntaxFix(
  workspacePath: string,
  failures: Failure[],
): Promise<SyntaxFixResult> {
  const syntaxFailures = failures.filter((f) => f.bugType === "SYNTAX");
  if (syntaxFailures.length === 0) return { fixedFiles: [] };

  const fixedFiles = new Set<string>();

  // Group by file to avoid redundant reads
  const byFile = new Map<string, Failure[]>();
  for (const f of syntaxFailures) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  for (const [file, fileFails] of byFile) {
    const filePath = join(workspacePath, file);
    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    let changed = false;

    for (const failure of fileFails) {
      const idx = failure.line - 1;
      if (idx < 0 || idx >= lines.length) continue;

      const line = lines[idx];

      // Fix 1: missing colon on block-opening line
      if (
        failure.message.toLowerCase().includes("expected ':'") ||
        failure.message.toLowerCase().includes("missing colon") ||
        failure.message.includes("E701") ||
        failure.message.includes("E999")
      ) {
        const m = BLOCK_KEYWORDS_RE.exec(line);
        if (m && !line.trimEnd().endsWith(":")) {
          lines[idx] = line.trimEnd() + ":";
          changed = true;
        }
      }

      // Fix 2: trailing semicolon (E703)
      if (failure.message.includes("E703") && line.trimEnd().endsWith(";")) {
        lines[idx] = line.trimEnd().slice(0, -1);
        changed = true;
      }
    }

    if (changed) {
      try {
        await writeFile(filePath, lines.join("\n"), "utf8");
        fixedFiles.add(file);
      } catch {
        // Write failed — skip
      }
    }
  }

  return { fixedFiles: Array.from(fixedFiles) };
}
