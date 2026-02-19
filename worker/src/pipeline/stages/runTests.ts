/** @format */

import { runInDocker } from "@rift/docker";
import type { PipelineContext } from "../context";
import { emit } from "../../emit";

export interface TestRunResult {
  passed: boolean;
  rawPytest: string;
  rawFlake8: string;
}

/**
 * RUN_TESTS: Runs pytest and flake8 inside Docker.
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

  // Run pytest and flake8 sequentially so their outputs stay separate
  const pytestResult = await runInDocker({
    workspacePath: ctx.workspacePath,
    // --tb=short: concise tracebacks; -q: less noise; --no-header: cleaner output
    command: "python -m pytest --tb=short -q --no-header 2>&1 || true",
  });

  const flake8Result = await runInDocker({
    workspacePath: ctx.workspacePath,
    // Default flake8 format: <file>:<line>:<col>: <code> <message>
    command: "python -m flake8 --format=default . 2>&1 || true",
  });

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
