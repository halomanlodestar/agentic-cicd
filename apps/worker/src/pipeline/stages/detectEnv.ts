/** @format */

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type { PipelineContext } from "../context";
import { emit } from "../../emit";

// Python project signal files (packaging / test config)
const PYTHON_SIGNALS = [
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "pytest.ini",
  "tox.ini",
  "conftest.py",
];

/** DETECT_ENV: Checks for Python project signal files or bare .py files. */
export async function stageDetectEnv(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "DETECT_ENV",
    "STARTED",
    "Detecting environment",
  );

  // 1. Preferred: explicit config / packaging file
  const signalFile = PYTHON_SIGNALS.find((f) =>
    existsSync(join(ctx.workspacePath, f)),
  );

  if (signalFile) {
    ctx.envType = "python";
    await emit(
      ctx.redis,
      ctx.runId,
      "DETECT_ENV",
      "COMPLETED",
      `Detected: Python (signal: ${signalFile})`,
    );
    return;
  }

  // 2. Fallback: any .py file at the repo root → bare Python project
  let hasPyFiles = false;
  try {
    hasPyFiles = readdirSync(ctx.workspacePath).some((f) => f.endsWith(".py"));
  } catch {
    // workspace not readable — leave hasPyFiles false
  }

  if (hasPyFiles) {
    ctx.envType = "python";
    await emit(
      ctx.redis,
      ctx.runId,
      "DETECT_ENV",
      "COMPLETED",
      "Detected: Python (bare .py files, no packaging config)",
    );
    return;
  }

  ctx.envType = "unsupported";
  await emit(
    ctx.redis,
    ctx.runId,
    "DETECT_ENV",
    "FAILED",
    "Unsupported environment — no Python files found",
  );
}
