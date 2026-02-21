/** @format */

import type { PipelineContext } from "../context.ts";
import { emit } from "../../emit.ts";
import { buildBranchName, commitAndPush } from "@rift/git";

/** COMMIT_CHANGES: Creates branch, commits all fixes, pushes to remote. */
export async function stageCommit(ctx: PipelineContext): Promise<void> {
  // Ensure branch name is set
  if (!ctx.branchName) {
    ctx.branchName = buildBranchName(ctx.input.teamName, ctx.input.leaderName);
  }

  ctx.commitCount += 1;

  await emit(
    ctx.redis,
    ctx.runId,
    "COMMIT_CHANGES",
    "STARTED",
    `Committing fix attempt ${ctx.commitCount} → ${ctx.branchName}`,
  );

  const fixSummary =
    ctx.fixes.length > 0
      ? ctx.fixes
          .filter((f) => f.status === "fixed")
          .map((f) => `${f.strategy}:${f.file}`)
          .slice(0, 3)
          .join(", ")
      : "applied deterministic fixes";

  const sha = await commitAndPush({
    workspacePath: ctx.workspacePath,
    input: ctx.input,
    branchName: ctx.branchName,
    commitCount: ctx.commitCount,
    fixSummary,
  });

  await emit(
    ctx.redis,
    ctx.runId,
    "COMMIT_CHANGES",
    "COMPLETED",
    sha
      ? `Commit ${sha.slice(0, 7)} pushed to ${ctx.branchName}`
      : `No changes to commit on attempt ${ctx.commitCount}`,
    { branchName: ctx.branchName, sha, commitCount: ctx.commitCount },
  );
}
