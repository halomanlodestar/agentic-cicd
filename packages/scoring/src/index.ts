/** @format */

import { writeFile } from "fs/promises";
import { join } from "path";
import type { RunResult, ScoreBreakdown } from "@rift/types";

const BASE_SCORE = 100;
const SPEED_BONUS = 10;
const SPEED_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const COMMIT_FREE_THRESHOLD = 20;
const COMMIT_PENALTY_PER_EXTRA = 2;

/**
 * Calculates the ScoreBreakdown for a completed run.
 *
 * Rules (per spec):
 *  base       = 100
 *  speedBonus = +10 if total duration < 5 min
 *  commitPenalty = -2 for each commit over 20
 *  total      = base + speedBonus - commitPenalty  (min 0)
 */
export function calculateScore(
  durationMs: number,
  commitCount: number,
): ScoreBreakdown {
  const speedBonus = durationMs < SPEED_THRESHOLD_MS ? SPEED_BONUS : 0;
  const commitPenalty =
    Math.max(0, commitCount - COMMIT_FREE_THRESHOLD) * COMMIT_PENALTY_PER_EXTRA;
  const total = Math.max(0, BASE_SCORE + speedBonus - commitPenalty);

  return {
    base: BASE_SCORE,
    speedBonus,
    commitPenalty,
    total,
    durationMs,
    commitCount,
  };
}

/**
 * Writes the final `results.json` file to the workspace root.
 * This is the artefact judges inspect.
 */
export async function writeResultsFile(
  workspacePath: string,
  result: RunResult,
): Promise<void> {
  const filePath = join(workspacePath, "results.json");
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf8");
}
