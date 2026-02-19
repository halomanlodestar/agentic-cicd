/** @format */

import { existsSync } from "fs";
import { join } from "path";
import { runInDocker } from "@rift/docker";
import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** INSTALL_DEPS: Installs Python dependencies inside a Docker sandbox. */
export async function stageInstallDeps(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "INSTALL_DEPS",
    "STARTED",
    "Installing dependencies",
  );

  const wp = ctx.workspacePath;
  let installCmd: string;

  if (existsSync(join(wp, "requirements.txt"))) {
    installCmd = "pip install --quiet -r requirements.txt";
  } else if (existsSync(join(wp, "pyproject.toml"))) {
    installCmd = "pip install --quiet .";
  } else if (existsSync(join(wp, "setup.py"))) {
    installCmd = "pip install --quiet -e .";
  } else {
    // Bare Python repo — no packaging config, just install tools
    installCmd = "echo 'No packaging config — skipping project install'";
  }

  // Always ensure test/lint tools are present in the sandbox
  installCmd += " && pip install --quiet pytest flake8 black autopep8";

  const result = await runInDocker({
    workspacePath: wp,
    command: installCmd,
    timeoutMs: 3 * 60 * 1000,
  });

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
