/** @format */

import { runInDocker } from "@rift/docker";
import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** CLONE_REPO: Clones the repository into the Docker container's /workspace mount. */
export async function stageClone(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "CLONE_REPO",
    "STARTED",
    `Cloning ${ctx.input.repoUrl}`,
  );

  // Run git clone inside Docker — the workspace bind-mount means the cloned
  // files land on the host too, but the clone itself never touches the host's git.
  const result = await runInDocker({
    workspacePath: ctx.workspacePath,
    image: "alpine/git",
    entrypoint: "sh",
    command: `git clone --depth 1 ${ctx.input.repoUrl} .`,
    timeoutMs: 3 * 60 * 1000,
    verbose: `clone:${ctx.runId.slice(0, 8)}`,
  });

  if (result.exitCode !== 0) {
    const message = result.stderr || result.stdout || "git clone failed";
    await emit(ctx.redis, ctx.runId, "CLONE_REPO", "FAILED", message);
    throw new Error(message);
  }

  await emit(
    ctx.redis,
    ctx.runId,
    "CLONE_REPO",
    "COMPLETED",
    `Repository cloned into container workspace`,
  );
}
