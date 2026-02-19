/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** COMMIT_CHANGES: Creates branch and commits fixes. [Phase 7] */
export async function stageCommit(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "COMMIT_CHANGES",
    "STARTED",
    "Committing fixes",
  );
  // TODO Phase 7: @rift/git — branchName, commitFixes, pushBranch
  ctx.commitCount += 1;
  await emit(
    ctx.redis,
    ctx.runId,
    "COMMIT_CHANGES",
    "COMPLETED",
    `Commit ${ctx.commitCount} pushed (stub)`,
  );
}
