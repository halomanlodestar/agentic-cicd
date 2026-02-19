/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** INSTALL_DEPS: Installs project dependencies inside Docker. [Phase 4] */
export async function stageInstallDeps(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "INSTALL_DEPS",
    "STARTED",
    "Installing dependencies",
  );
  // TODO Phase 4: runInDocker("pip install -r requirements.txt")
  await emit(
    ctx.redis,
    ctx.runId,
    "INSTALL_DEPS",
    "COMPLETED",
    "Dependencies installed",
  );
}
