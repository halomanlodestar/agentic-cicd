/** @format */

import { Queue } from "bullmq";
import type { RunInput } from "@rift/types";
import { randomUUID } from "crypto";

function getConnection() {
  return {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    maxRetriesPerRequest: null, // required by BullMQ connections
  };
}

let _queue: Queue | null = null;

function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue("pipeline", { connection: getConnection() });
  }
  return _queue;
}

/**
 * Enqueue a new pipeline run job.
 * Returns the runId that can be used to track progress.
 */
export async function enqueueRun(input: RunInput): Promise<string> {
  const runId = randomUUID();
  const queue = getQueue();

  await queue.add(
    "run",
    { ...input, runId },
    {
      jobId: runId,
      attempts: 1, // pipeline handles its own retries internally
      removeOnComplete: { age: 60 * 60 * 24 }, // keep 24h
      removeOnFail: { age: 60 * 60 * 24 },
    },
  );

  return runId;
}

export type { RunInput };
