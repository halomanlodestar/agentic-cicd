/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";

export interface TestRunResult {
  passed: boolean;
  rawPytest: string;
  rawFlake8: string;
}

/** RUN_TESTS: Runs pytest and flake8 inside Docker. [Phase 4] */
export async function stageRunTests(
  ctx: PipelineContext,
): Promise<TestRunResult> {
  await emit(ctx.redis, ctx.runId, "RUN_TESTS", "STARTED", "Running tests");
  // TODO Phase 4: runInDocker("pytest --tb=short -q && flake8")
  await emit(
    ctx.redis,
    ctx.runId,
    "RUN_TESTS",
    "COMPLETED",
    "Tests passed (stub)",
  );
  return { passed: true, rawPytest: "", rawFlake8: "" };
}
