/** @format */

import { existsSync } from "fs";
import { join } from "path";
import type { PipelineContext } from "../context";
import { emit } from "../../emit";

// Python project signal files
const PYTHON_SIGNALS = [
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "pytest.ini",
  "tox.ini",
];

/** DETECT_ENV: Checks for Python project signal files to determine environment. */
export async function stageDetectEnv(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "DETECT_ENV",
    "STARTED",
    "Detecting environment",
  );

  const found = PYTHON_SIGNALS.find((f) =>
    existsSync(join(ctx.workspacePath, f)),
  );

  if (found) {
    ctx.envType = "python";
    await emit(
      ctx.redis,
      ctx.runId,
      "DETECT_ENV",
      "COMPLETED",
      `Detected: Python (signal: ${found})`,
    );
  } else {
    ctx.envType = "unsupported";
    await emit(
      ctx.redis,
      ctx.runId,
      "DETECT_ENV",
      "FAILED",
      "Unsupported environment — no Python project signals found",
    );
  }
}
