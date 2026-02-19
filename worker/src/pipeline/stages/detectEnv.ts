/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";

/** DETECT_ENV: Detects the repo language/build environment. [Phase 4] */
export async function stageDetectEnv(ctx: PipelineContext): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "DETECT_ENV",
    "STARTED",
    "Detecting environment",
  );
  // TODO Phase 4: check for requirements.txt / pyproject.toml / pytest.ini
  ctx.envType = "python";
  await emit(
    ctx.redis,
    ctx.runId,
    "DETECT_ENV",
    "COMPLETED",
    "Detected: Python",
  );
}
