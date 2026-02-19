/** @format */

import { execa } from "execa";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DockerRunOpts {
  /** Absolute path on the host to mount as /workspace inside the container */
  workspacePath: string;
  /** Shell command to run inside the container */
  command: string;
  /** Docker image to use (defaults to python:3.11-slim) */
  image?: string;
  /** Extra environment variables to inject */
  env?: Record<string, string>;
  /** Timeout in milliseconds (defaults to 5 minutes) */
  timeoutMs?: number;
}

export interface DockerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Runs a shell command inside a throwaway Docker container.
 * The workspace directory is mounted as /workspace (read-write).
 * The container is always removed after execution (--rm).
 * Never throws — always returns an exitCode instead.
 */
export async function runInDocker(
  opts: DockerRunOpts,
): Promise<DockerRunResult> {
  const {
    workspacePath,
    command,
    image = "python:3.11-slim",
    env = {},
    timeoutMs = 5 * 60 * 1000,
  } = opts;

  const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);

  try {
    const result = await execa(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "host", // allow pip install; isolate at the VM level
        "--memory",
        "512m",
        "--cpus",
        "1",
        "-v",
        `${workspacePath}:/workspace:rw`,
        "-w",
        "/workspace",
        ...envArgs,
        image,
        "sh",
        "-c",
        command,
      ],
      { timeout: timeoutMs, reject: false },
    );

    return {
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
      exitCode: result.exitCode ?? 0,
    };
  } catch (err: unknown) {
    // execa throws on ETIMEDOUT / spawn errors even with reject: false
    const e = err as {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      message?: string;
    };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? String(err),
      exitCode: e.exitCode ?? 1,
    };
  }
}
