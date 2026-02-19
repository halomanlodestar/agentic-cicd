/** @format */

import type { Job } from "bullmq";
import type { RunInput } from "@rift/types";
import { createClient } from "@rift/redis";
import { emit } from "../emit";
import { createContext } from "./context";
import { stageInit } from "./stages/init";
import { stageClone } from "./stages/clone";
import { stageDetectEnv } from "./stages/detectEnv";
import { stageInstallDeps } from "./stages/installDeps";
import { stageRunTests } from "./stages/runTests";
import { stageParseFailures } from "./stages/parseFailures";
import { stageApplyFixes } from "./stages/applyFixes";
import { stageCommit } from "./stages/commit";
import { stageFinish } from "./stages/finish";

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 5);

// ─── Job payload shape ────────────────────────────────────────────────────────

interface JobData extends RunInput {
  runId: string;
}

// ─── Pipeline entry point ─────────────────────────────────────────────────────

/**
 * Main pipeline processor. Called by the BullMQ Worker for every "run" job.
 * Orchestrates all stages and manages the fix→retest retry loop.
 */
export async function runPipeline(job: Job<JobData>): Promise<void> {
  const { runId, repoUrl, teamName, leaderName } = job.data;
  const input: RunInput = { repoUrl, teamName, leaderName };

  const redis = createClient({ noRetry: true });
  const ctx = createContext(runId, input, redis);

  try {
    // ── Linear stages ──────────────────────────────────────────────────────
    await stageInit(ctx);
    await stageClone(ctx);
    await stageDetectEnv(ctx);

    if (ctx.envType === "unsupported") {
      await emit(
        redis,
        runId,
        "FAILED",
        "FAILED",
        "Unsupported environment — only Python is supported",
      );
      return;
    }

    await stageInstallDeps(ctx);

    // ── Initial test run ───────────────────────────────────────────────────
    let testResult = await stageRunTests(ctx);

    if (testResult.passed) {
      await stageFinish(ctx, true);
      return;
    }

    // ── Fix → Retest loop ──────────────────────────────────────────────────
    let retryCount = 0;

    while (!testResult.passed && retryCount < MAX_RETRIES) {
      await stageParseFailures(ctx, testResult);
      await stageApplyFixes(ctx);
      await stageCommit(ctx);

      // Retest
      const iteration = retryCount + 1;
      await emit(
        redis,
        runId,
        "RETEST",
        "STARTED",
        `Retest iteration ${iteration}/${MAX_RETRIES}`,
      );
      testResult = await stageRunTests(ctx);

      ctx.iterations.push({
        iteration,
        maxIterations: MAX_RETRIES,
        passed: testResult.passed,
        timestamp: new Date().toISOString(),
        failureCount: ctx.failures.length,
      });

      await emit(
        redis,
        runId,
        "RETEST",
        testResult.passed ? "COMPLETED" : "FAILED",
        testResult.passed
          ? `Retest ${iteration} passed`
          : `Retest ${iteration} still failing`,
      );

      retryCount++;
    }

    await stageFinish(ctx, testResult.passed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline:${runId}] Unhandled error:`, err);
    try {
      await emit(
        redis,
        runId,
        "FAILED",
        "FAILED",
        `Pipeline error: ${message}`,
      );
    } catch {
      // Redis may be unavailable — swallow to avoid masking original error
    }
    throw err; // re-throw so BullMQ marks the job as failed
  } finally {
    redis.disconnect();
  }
}
