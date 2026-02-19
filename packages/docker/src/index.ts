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
  /** Override the image entrypoint (e.g. "sh" for images like alpine/git) */
  entrypoint?: string;
  /** Extra environment variables to inject */
  env?: Record<string, string>;
  /** Timeout in milliseconds (defaults to 5 minutes) */
  timeoutMs?: number;
  /** If set, stream each output line to the worker terminal prefixed with this label */
  verbose?: string;
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
    entrypoint,
    env = {},
    timeoutMs = 5 * 60 * 1000,
    verbose,
  } = opts;

  const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  const entrypointArgs = entrypoint ? ["--entrypoint", entrypoint] : [];

  try {
    const subprocess = execa(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "host",
        "--memory",
        "512m",
        "--cpus",
        "1",
        "-v",
        `${workspacePath}:/workspace:rw`,
        "-w",
        "/workspace",
        ...envArgs,
        ...entrypointArgs,
        image,
        ...(entrypoint ? [] : ["sh"]),
        "-c",
        command,
      ],
      { timeout: timeoutMs, reject: false },
    );

    // Stream output to the worker terminal if verbose label is set
    let stdoutBuf = "";
    let stderrBuf = "";

    subprocess.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutBuf += text;
      if (verbose)
        process.stdout.write(text.replace(/^/gm, `[docker:${verbose}] `));
    });

    subprocess.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuf += text;
      if (verbose)
        process.stderr.write(text.replace(/^/gm, `[docker:${verbose}] `));
    });

    const result = await subprocess;

    return {
      stdout:
        stdoutBuf || (typeof result.stdout === "string" ? result.stdout : ""),
      stderr:
        stderrBuf || (typeof result.stderr === "string" ? result.stderr : ""),
      exitCode: result.exitCode ?? 0,
    };
  } catch (err: unknown) {
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

// ─── Persistent session ───────────────────────────────────────────────────────

/**
 * A long-lived Docker container that persists across multiple exec() calls.
 * Use this instead of runInDocker() when multiple commands need shared state
 * (installed packages, environment variables, etc.).
 */
export class DockerSession {
  private readonly name: string;
  private readonly workspacePath: string;
  private readonly image: string;
  private running = false;

  constructor(name: string, workspacePath: string, image = "python:3.11-slim") {
    this.name = name;
    this.workspacePath = workspacePath;
    this.image = image;
  }

  /** Start the container in detached mode, keeping it alive with `sleep infinity`. */
  async start(): Promise<void> {
    await execa("docker", [
      "run",
      "-d",
      "--name",
      this.name,
      "--network",
      "host",
      "--memory",
      "512m",
      "--cpus",
      "1",
      "-v",
      `${this.workspacePath}:/workspace:rw`,
      "-w",
      "/workspace",
      this.image,
      "sleep",
      "infinity",
    ]);
    this.running = true;
  }

  /** Execute a shell command inside the running container with optional live streaming. */
  async exec(command: string, verbose?: string): Promise<DockerRunResult> {
    const subprocess = execa(
      "docker",
      ["exec", this.name, "sh", "-c", command],
      { reject: false },
    );

    let stdoutBuf = "";
    let stderrBuf = "";

    subprocess.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutBuf += text;
      if (verbose)
        process.stdout.write(text.replace(/^/gm, `[docker:${verbose}] `));
    });

    subprocess.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuf += text;
      if (verbose)
        process.stderr.write(text.replace(/^/gm, `[docker:${verbose}] `));
    });

    const result = await subprocess;
    return {
      stdout:
        stdoutBuf || (typeof result.stdout === "string" ? result.stdout : ""),
      stderr:
        stderrBuf || (typeof result.stderr === "string" ? result.stderr : ""),
      exitCode: result.exitCode ?? 0,
    };
  }

  /** Stop and remove the container. Safe to call multiple times. */
  async stop(): Promise<void> {
    if (this.running) {
      await execa("docker", ["rm", "-f", this.name], { reject: false });
      this.running = false;
    }
  }
}
