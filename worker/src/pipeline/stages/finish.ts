/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";
import { storeResult } from "@rift/redis";
import type { RunResult } from "@rift/types";

/** DONE / FAILED: Calculates score, writes results.json and Redis result. [Phase 8] */
export async function stageFinish(
  ctx: PipelineContext,
  passed: boolean,
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - new Date(ctx.startedAt).getTime();

  // TODO Phase 8: use @rift/scoring for real score calculation
  const score = {
    base: 100,
    speedBonus: durationMs < 5 * 60 * 1000 ? 10 : 0,
    commitPenalty: Math.max(0, ctx.commitCount - 20) * 2,
    get total() {
      return this.base + this.speedBonus - this.commitPenalty;
    },
    durationMs,
    commitCount: ctx.commitCount,
  };

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
    iterations: ctx.iterations,
    score,
    startedAt: ctx.startedAt,
    finishedAt,
    durationMs,
  };

  await storeResult(ctx.redis, ctx.runId, result);

  const finalStage = passed ? "DONE" : "FAILED";
  await emit(
    ctx.redis,
    ctx.runId,
    finalStage,
    passed ? "COMPLETED" : "FAILED",
    passed ? "All tests passed" : "Pipeline failed — retry limit reached",
    result,
  );
}
