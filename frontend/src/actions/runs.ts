/** @format */

"use server";

import { enqueueRun } from "@rift/queue";
import { createClient, readResult } from "@rift/redis";
import type { RunInput, RunResult } from "@rift/types";
import z from "zod";

const startRunSchema = z.object({
  repoUrl: z.string().trim().min(1, "Repository URL is required"),
  teamName: z.string().trim().min(1, "Team name is required"),
  leaderName: z.string().trim().min(1, "Leader name is required"),
});

/**
 * Validates input, enqueues a pipeline run job, and returns the runId.
 * Called from the Input page form.
 */
export async function startRun(
  input: RunInput,
): Promise<{ runId: string } | { error: string }> {
  const { repoUrl, teamName, leaderName } = input;

  const parsed = startRunSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const url = new URL(repoUrl);
    if (!["https:", "http:"].includes(url.protocol)) {
      return { error: "Repository URL must be an HTTP/HTTPS URL" };
    }
  } catch {
    return { error: "Repository URL is not a valid URL" };
  }

  try {
    const runId = await enqueueRun({ repoUrl, teamName, leaderName });
    return { runId };
  } catch (err) {
    console.error("[startRun] Failed to enqueue run:", err);
    return { error: "Failed to start run. Please try again." };
  }
}

/**
 * Reads the final RunResult from Redis for a given runId.
 * Returns null if the run hasn't completed yet.
 */
export async function getRunResult(runId: string): Promise<RunResult | null> {
  const redis = createClient();
  try {
    return await readResult(redis, runId);
  } finally {
    redis.disconnect();
  }
}
