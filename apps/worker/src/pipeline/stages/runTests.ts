/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";

export interface TestRunResult {
  passed: boolean;
  rawPytest: string;
  rawFlake8: string;
}

/**
 * RUN_TESTS: Runs pytest and flake8 inside Docker.
 * Each container is ephemeral (--rm), so we reinstall tools on every run.
 * Both tools run independently — we collect both outputs regardless of exit codes.
 * passed = true only when BOTH exit with 0.
 */
export async function stageRunTests(
  ctx: PipelineContext,
): Promise<TestRunResult> {
  await emit(
    ctx.redis,
    ctx.runId,
    "RUN_TESTS",
    "STARTED",
    "Running tests and linter",
  );

  // Use the persistent container started in installDeps — no reinstall needed
  const container = ctx.container!;

  const pytestResult = await container.exec(
    "python -m pytest --tb=short -q --no-header 2>&1",
    `pytest:${ctx.runId.slice(0, 8)}`,
  );

  const flake8Result = await container.exec(
    "python -m flake8 --format=default .",
    `flake8:${ctx.runId.slice(0, 8)}`,
  );

  const rawPytest = pytestResult.stdout + pytestResult.stderr;
  const rawFlake8 = flake8Result.stdout + flake8Result.stderr;

  const pytestPassed = pytestResult.exitCode === 0;
  const flake8Passed = flake8Result.exitCode === 0;
  const passed = pytestPassed && flake8Passed;

  const summary = [
    pytestPassed ? "pytest: PASS" : "pytest: FAIL",
    flake8Passed ? "flake8: PASS" : "flake8: FAIL",
  ].join(" | ");

  await emit(
    ctx.redis,
    ctx.runId,
    "RUN_TESTS",
    passed ? "COMPLETED" : "FAILED",
    summary,
    { rawPytest, rawFlake8 },
  );

  return { passed, rawPytest, rawFlake8 };
}
