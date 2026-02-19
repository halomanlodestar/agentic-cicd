/** @format */

import type { Failure, FixRecord } from "@rift/types";
import type { DockerSession } from "@rift/docker";
import { runFormatter } from "./formatter.ts";
import { runLinterFix } from "./linter.ts";
import { runImportFix } from "./imports.ts";
import { runSyntaxFix } from "./syntax.ts";

export { runFormatter } from "./formatter.ts";
export { runLinterFix } from "./linter.ts";
export { runImportFix } from "./imports.ts";
export { runSyntaxFix } from "./syntax.ts";

/**
 * Runs the full deterministic fix hierarchy in priority order:
 *   formatter → linter → imports → syntax
 *
 * Each stage records a FixRecord regardless of success/failure.
 */
export async function applyDeterministicFixes(
  failures: Failure[],
  workspacePath: string,
  session: DockerSession,
): Promise<FixRecord[]> {
  const records: FixRecord[] = [];

  // Stage 1: black formatter (touches all Python files)
  try {
    const res = await runFormatter(session);
    if (res.reformattedFiles.length > 0) {
      for (const file of res.reformattedFiles) {
        records.push({
          bugType: "LINTING",
          file,
          line: 0,
          strategy: "formatter",
          status: "fixed",
          commitMessage: `black reformatted ${file}`,
        });
      }
    }
  } catch (err) {
    records.push({
      bugType: "LINTING",
      file: ".",
      line: 0,
      strategy: "formatter",
      status: "failed",
      commitMessage: `formatter error: ${String(err)}`,
    });
  }

  // Stage 2: autopep8 linter fix for LINTING/INDENTATION failures
  const lintFailures = failures.filter(
    (f) => f.bugType === "LINTING" || f.bugType === "INDENTATION",
  );
  if (lintFailures.length > 0) {
    try {
      const res = await runLinterFix(session, lintFailures);
      if (res.fixedCount > 0) {
        records.push({
          bugType: "LINTING",
          file: ".",
          line: 0,
          strategy: "linter",
          status: "fixed",
          commitMessage: `autopep8 fixed ${res.fixedCount} file(s)`,
        });
      }
    } catch (err) {
      records.push({
        bugType: "LINTING",
        file: ".",
        line: 0,
        strategy: "linter",
        status: "failed",
        commitMessage: `linter error: ${String(err)}`,
      });
    }
  }

  // Stage 3: unused import removal
  const importFailures = failures.filter((f) => f.bugType === "IMPORT");
  if (importFailures.length > 0) {
    try {
      const res = await runImportFix(workspacePath, importFailures);
      for (const file of res.fixedFiles) {
        records.push({
          bugType: "IMPORT",
          file,
          line: 0,
          strategy: "imports",
          status: "fixed",
          commitMessage: `removed unused imports in ${file}`,
        });
      }
    } catch (err) {
      records.push({
        bugType: "IMPORT",
        file: ".",
        line: 0,
        strategy: "imports",
        status: "failed",
        commitMessage: `import fix error: ${String(err)}`,
      });
    }
  }

  // Stage 4: syntax patching
  const syntaxFailures = failures.filter((f) => f.bugType === "SYNTAX");
  if (syntaxFailures.length > 0) {
    try {
      const res = await runSyntaxFix(workspacePath, syntaxFailures);
      for (const file of res.fixedFiles) {
        records.push({
          bugType: "SYNTAX",
          file,
          line: 0,
          strategy: "syntax",
          status: "fixed",
          commitMessage: `patched syntax in ${file}`,
        });
      }
    } catch (err) {
      records.push({
        bugType: "SYNTAX",
        file: ".",
        line: 0,
        strategy: "syntax",
        status: "failed",
        commitMessage: `syntax fix error: ${String(err)}`,
      });
    }
  }

  return records;
}
