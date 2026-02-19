/** @format */

// ─── Pipeline Stages ─────────────────────────────────────────────────────────

export type PipelineStage =
  | "INIT"
  | "CLONE_REPO"
  | "DETECT_ENV"
  | "INSTALL_DEPS"
  | "RUN_TESTS"
  | "PARSE_FAILURES"
  | "APPLY_DETERMINISTIC_FIXES"
  | "APPLY_AI_FIX"
  | "COMMIT_CHANGES"
  | "RETEST"
  | "DONE"
  | "FAILED";

export const PIPELINE_STAGES: PipelineStage[] = [
  "INIT",
  "CLONE_REPO",
  "DETECT_ENV",
  "INSTALL_DEPS",
  "RUN_TESTS",
  "PARSE_FAILURES",
  "APPLY_DETERMINISTIC_FIXES",
  "COMMIT_CHANGES",
  "RETEST",
  "DONE",
];

// ─── Event Status ─────────────────────────────────────────────────────────────

export type EventStatus = "STARTED" | "COMPLETED" | "FAILED" | "SKIPPED";

// ─── Bug Types ────────────────────────────────────────────────────────────────

export type BugType =
  | "LINTING"
  | "SYNTAX"
  | "IMPORT"
  | "INDENTATION"
  | "TYPE_ERROR"
  | "LOGIC";

// ─── Core Data Shapes ─────────────────────────────────────────────────────────

export interface Failure {
  file: string;
  line: number;
  bugType: BugType;
  message: string;
}

export interface FixRecord {
  file: string;
  bugType: BugType;
  line: number;
  commitMessage: string;
  status: "fixed" | "failed";
}

export interface CiIteration {
  iteration: number;
  maxIterations: number;
  passed: boolean;
  timestamp: string;
  failureCount: number;
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  commitPenalty: number;
  total: number;
  durationMs: number;
  commitCount: number;
}

// ─── Run I/O ─────────────────────────────────────────────────────────────────

export interface RunInput {
  repoUrl: string;
  teamName: string;
  leaderName: string;
}

export interface RunResult {
  runId: string;
  repoUrl: string;
  teamName: string;
  leaderName: string;
  branchName: string;
  status: "PASSED" | "FAILED";
  totalFailuresDetected: number;
  totalFixesApplied: number;
  fixes: FixRecord[];
  iterations: CiIteration[];
  score: ScoreBreakdown;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

// ─── Pipeline Events ──────────────────────────────────────────────────────────

export interface PipelineEvent {
  runId: string;
  stage: PipelineStage;
  status: EventStatus;
  message: string;
  timestamp: string;
  /** Optional structured payload — fix records, failures, score, etc. */
  data?: unknown;
}
