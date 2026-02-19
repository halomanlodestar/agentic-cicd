/** @format */

import type { PipelineContext } from "../context.ts";
import { emit } from "../../emit.ts";
import { applyDeterministicFixes } from "@rift/fixes";

/** APPLY_DETERMINISTIC_FIXES: Runs formatter → linter → imports → syntax fix hierarchy. */
export async function stageApplyFixes(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "APPLY_DETERMINISTIC_FIXES",
    "STARTED",
    `Applying fixes for ${ctx.failures.length} failure(s)`,
  );

  const newRecords = await applyDeterministicFixes(
    ctx.failures,
    ctx.workspacePath,
  );

  ctx.fixes.push(...newRecords);

  const fixed = newRecords.filter((r) => r.status === "fixed").length;
  const failed = newRecords.filter((r) => r.status === "failed").length;

  await emit(
    ctx.redis,
    ctx.runId,
    "APPLY_DETERMINISTIC_FIXES",
    "COMPLETED",
    `Applied ${fixed} fix(es), ${failed} failed`,
    { records: newRecords },
  );
}
