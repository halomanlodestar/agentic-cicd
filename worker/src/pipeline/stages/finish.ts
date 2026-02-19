/** @format */

import type { PipelineContext } from "../context.ts";
import { emit } from "../../emit.ts";
import { storeResult } from "@rift/redis";
import { calculateScore, writeResultsFile } from "@rift/scoring";
import type { RunResult } from "@rift/types";

/** DONE / FAILED: Calculates score, writes results.json and Redis result. */
export async function stageFinish(
  ctx: PipelineContext,
  passed: boolean,
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - new Date(ctx.startedAt).getTime();

  const score = calculateScore(durationMs, ctx.commitCount);

  const result: RunResult = {
    runId: ctx.runId,
    repoUrl: ctx.input.repoUrl,
    teamName: ctx.input.teamName,
    leaderName: ctx.input.leaderName,
    branchName: ctx.branchName ?? "",
    status: passed ? "PASSED" : "FAILED",
    totalFailuresDetected: ctx.failures.length,
    totalFixesApplied: ctx.fixes.filter((f) => f.status === "fixed").length,
    fixes: ctx.fixes,
    failureDetails: ctx.failures,
    iterations: ctx.iterations,
    score,
    startedAt: ctx.startedAt,
    finishedAt,
    durationMs,
  };

  // Persist result to Redis (for SSE late-join + frontend result page)
  await storeResult(ctx.redis, ctx.runId, result);

  // Write results.json into the repo workspace for judges
  await writeResultsFile(ctx.workspacePath, result);

  const finalStage = passed ? "DONE" : "FAILED";
  await emit(
    ctx.redis,
    ctx.runId,
    finalStage,
    passed ? "COMPLETED" : "FAILED",
    passed
      ? `All tests passed — score ${score.total}`
      : `Pipeline exhausted — final score ${score.total}`,
    result,
  );
}
