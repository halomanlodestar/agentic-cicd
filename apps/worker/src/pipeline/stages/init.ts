/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";
import { createWorkspace } from "../../workspace";

/**
 * INIT: Creates the workspace directory and records run metadata.
 */
export async function stageInit(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "INIT",
    "STARTED",
    "Initializing run workspace",
  );

  ctx.workspacePath = await createWorkspace(ctx.runId);

  await emit(
    ctx.redis,
    ctx.runId,
    "INIT",
    "COMPLETED",
    `Workspace ready at ${ctx.workspacePath}`,
  );
}
