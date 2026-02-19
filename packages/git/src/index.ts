/** @format */

import { simpleGit } from "simple-git";
import type { RunInput } from "@rift/types";

// ─── Branch Naming ────────────────────────────────────────────────────────────

/**
 * Returns the regulated branch name per spec:
 *   `TEAMNAME_LEADERNAME_AI_Fix`
 * Strips non-alphanumeric chars, uppercases, joins with underscores.
 */
export function buildBranchName(teamName: string, leaderName: string): string {
  const sanitize = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  return `${sanitize(teamName)}_${sanitize(leaderName)}_AI_Fix`;
}

// ─── Git Operations ───────────────────────────────────────────────────────────

/**
 * Configure git identity in the workspace repo.
 * Reads GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL env vars (with sane defaults).
 */
export async function configureGitIdentity(workspacePath: string) {
  const git = simpleGit(workspacePath);
  const name = process.env.GIT_AUTHOR_NAME ?? "RIFT AI Agent";
  const email = process.env.GIT_AUTHOR_EMAIL ?? "ai-agent@rift.local";
  await git.addConfig("user.name", name, false, "local");
  await git.addConfig("user.email", email, false, "local");
}

/**
 * Create and checkout a new branch.
 * If the branch already exists, just checks it out.
 */
export async function initBranch(
  workspacePath: string,
  branchName: string,
): Promise<void> {
  const git = simpleGit(workspacePath);
  await configureGitIdentity(workspacePath);
  const branches = await git.branchLocal();
  if (branches.all.includes(branchName)) {
    await git.checkout(branchName);
  } else {
    await git.checkoutLocalBranch(branchName);
  }
}

/**
 * Stage all changes and create a commit.
 * Returns the short commit SHA.
 */
export async function commitFixes(
  workspacePath: string,
  branchName: string,
  commitCount: number,
  fixSummary: string,
): Promise<string> {
  const git = simpleGit(workspacePath);
  await git.add(".");
  const status = await git.status();
  if (status.staged.length === 0 && !status.isClean()) {
    // Nothing staged after `git add .` means there truly are no changes
    return "";
  }
  const message = `[AI-AGENT] Fix: ${fixSummary} (attempt ${commitCount})`;
  const result = await git.commit(message);
  return result.commit ?? "";
}

/**
 * Push the branch to the remote origin.
 * Injects GIT_TOKEN into the remote URL for HTTPS auth if provided.
 */
export async function pushBranch(
  workspacePath: string,
  branchName: string,
  repoUrl: string,
): Promise<void> {
  const git = simpleGit(workspacePath);

  const token = process.env.GIT_TOKEN;
  if (token) {
    // Transform https://github.com/user/repo → https://token@github.com/user/repo
    const authenticatedUrl = repoUrl.replace(
      /^(https?:\/\/)/,
      `$1${encodeURIComponent(token)}@`,
    );
    await git.remote(["set-url", "origin", authenticatedUrl]);
  }

  await git.push("origin", branchName, ["--set-upstream"]);
}

// ─── Convenience orchestrator ─────────────────────────────────────────────────

export interface CommitAndPushOptions {
  workspacePath: string;
  input: RunInput;
  branchName: string;
  commitCount: number;
  fixSummary: string;
}

/**
 * Full commit + push operation for use in the pipeline stage.
 * Returns the commit SHA (empty string if nothing to commit).
 */
export async function commitAndPush(
  opts: CommitAndPushOptions,
): Promise<string> {
  const { workspacePath, input, branchName, commitCount, fixSummary } = opts;
  await initBranch(workspacePath, branchName);
  const sha = await commitFixes(
    workspacePath,
    branchName,
    commitCount,
    fixSummary,
  );
  if (sha) {
    await pushBranch(workspacePath, branchName, input.repoUrl);
  }
  return sha;
}
