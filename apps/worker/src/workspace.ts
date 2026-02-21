/** @format */

import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { tmpdir } from "os";

// ─── Base runs directory ──────────────────────────────────────────────────────
// Falls back to os.tmpdir() so it works on both Windows and Linux/macOS.
const RUNS_BASE = process.env.RUNS_DIR ?? join(tmpdir(), "rift-runs");

// ─── Public API ───────────────────────────────────────────────────────────────

export function getWorkspacePath(runId: string): string {
  return join(RUNS_BASE, runId);
}

/**
 * Creates an empty workspace directory for a run.
 * Safe to call multiple times — uses mkdir with recursive.
 */
export async function createWorkspace(runId: string): Promise<string> {
  const path = getWorkspacePath(runId);
  await mkdir(path, { recursive: true });
  return path;
}

/**
 * Removes the workspace directory and all its contents.
 * Silent if the directory doesn't exist.
 */
export async function cleanupWorkspace(runId: string): Promise<void> {
  const path = getWorkspacePath(runId);
  if (existsSync(path)) {
    await rm(path, { recursive: true, force: true });
  }
}
