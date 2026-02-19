/** @format */

import simpleGit from "simple-git";
import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** CLONE_REPO: Clones the repository into the workspace using simple-git. */
export async function stageClone(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "CLONE_REPO",
    "STARTED",
    `Cloning ${ctx.input.repoUrl}`,
  );

  try {
    const git = simpleGit();
    await git.clone(ctx.input.repoUrl, ctx.workspacePath, [
      "--depth",
      "1", // shallow clone — faster, we only need the latest state
    ]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await emit(
      ctx.redis,
      ctx.runId,
      "CLONE_REPO",
      "FAILED",
      `Clone failed: ${message}`,
    );
    throw err;
  }

  await emit(
    ctx.redis,
    ctx.runId,
    "CLONE_REPO",
    "COMPLETED",
    `Repository cloned to ${ctx.workspacePath}`,
  );
}
