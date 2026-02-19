/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** APPLY_DETERMINISTIC_FIXES: Runs formatter, linter, import, syntax fixes. [Phase 6] */
export async function stageApplyFixes(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "APPLY_DETERMINISTIC_FIXES",
    "STARTED",
    `Applying fixes for ${ctx.failures.length} failure(s)`,
  );
  // TODO Phase 6: @rift/fixes
  await emit(
    ctx.redis,
    ctx.runId,
    "APPLY_DETERMINISTIC_FIXES",
    "COMPLETED",
    "Fixes applied (stub)",
  );
}
