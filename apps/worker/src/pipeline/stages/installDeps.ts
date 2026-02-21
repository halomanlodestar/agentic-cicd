/** @format */

import { DockerSession } from "@rift/docker";
import type { PipelineContext } from "../context.ts";
import { emit } from "../../emit.ts";
import { buildPipInstallCmd } from "../pythonEnv.ts";

/**
 * INSTALL_DEPS: Starts the long-lived pipeline container and installs deps.
 * The container persists for all subsequent stages (runTests, applyFixes, etc.).
 */
export async function stageInstallDeps(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "INSTALL_DEPS",
    "STARTED",
    "Starting container and installing dependencies",
  );

  // Start the persistent container — all subsequent stages exec into this
  ctx.container = new DockerSession(ctx.runId, ctx.workspacePath);
  await ctx.container.start();

  const installCmd = buildPipInstallCmd(ctx.workspacePath);
  const result = await ctx.container.exec(
    installCmd,
    `install:${ctx.runId.slice(0, 8)}`,
  );

  if (result.exitCode !== 0) {
    const detail = (result.stderr || result.stdout).slice(0, 500);
    await emit(
      ctx.redis,
      ctx.runId,
      "INSTALL_DEPS",
      "FAILED",
      `Dependency install failed (exit ${result.exitCode}): ${detail}`,
    );
    throw new Error(`pip install failed with exit code ${result.exitCode}`);
  }

  await emit(
    ctx.redis,
    ctx.runId,
    "INSTALL_DEPS",
    "COMPLETED",
    "Dependencies installed successfully",
  );
}
