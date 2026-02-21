/** @format */

import type IORedis from "ioredis";
import type { RunInput, Failure, FixRecord, CiIteration } from "@rift/types";
import type { DockerSession } from "@rift/docker";

// ─── Context passed through every pipeline stage ─────────────────────────────

export interface PipelineContext {
  /** Unique run identifier */
  runId: string;
  /** Original job payload */
  input: RunInput;
  /** Absolute path to the cloned repo on disk */
  workspacePath: string;
  /** Redis client for publishing events */
  redis: IORedis;

  // ── Accumulated state ────────────────────────────────────────────────────

  /** Detected environment type (python | unsupported) */
  envType: "python" | "unsupported" | null;
  /** Current set of failures from the last test run */
  failures: Failure[];
  /** All fix records accumulated across all iterations */
  fixes: FixRecord[];
  /** One entry per retest iteration */
  iterations: CiIteration[];
  /** Total commits made on the fix branch */
  commitCount: number;
  /** Git branch name created for this run */
  branchName: string | null;
  /** Long-lived Docker container for the run (started in installDeps, stopped in finally) */
  container: DockerSession | null;

  // ── Timing ───────────────────────────────────────────────────────────────

  startedAt: string;
}

export function createContext(
  runId: string,
  input: RunInput,
  redis: IORedis,
): PipelineContext {
  return {
    runId,
    input,
    workspacePath: "",
    redis,
    envType: null,
    failures: [],
    fixes: [],
    iterations: [],
    commitCount: 0,
    branchName: null,
    container: null,
    startedAt: new Date().toISOString(),
  };
}
