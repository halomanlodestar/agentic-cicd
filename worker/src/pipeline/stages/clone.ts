/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** CLONE_REPO: Clones the repository into the workspace. [Phase 4] */
export async function stageClone(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "CLONE_REPO",
    "STARTED",
    `Cloning ${ctx.input.repoUrl}`,
  );
  // TODO Phase 4: implement with simple-git
  await emit(
    ctx.redis,
    ctx.runId,
    "CLONE_REPO",
    "COMPLETED",
    "Repository cloned",
  );
}
