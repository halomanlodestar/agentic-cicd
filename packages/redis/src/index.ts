/** @format */

import IORedis from "ioredis";
import type { PipelineEvent, RunResult } from "@rift/types";

// ─── Key helpers ─────────────────────────────────────────────────────────────

export const keys = {
  eventChannel: (runId: string) => `events:${runId}`,
  eventList: (runId: string) => `run:${runId}:events`,
  result: (runId: string) => `run:${runId}:result`,
  meta: (runId: string) => `run:${runId}:meta`,
};

// ─── Client factory ───────────────────────────────────────────────────────────

function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not set");
  return url;
}

/**
 * Creates a regular Redis client for commands (get, set, publish, lpush, etc.)
 * maxRetriesPerRequest: null is required by BullMQ connections.
 */
export function createClient(opts?: { noRetry?: boolean }): IORedis {
  return new IORedis(redisUrl(), {
    maxRetriesPerRequest: opts?.noRetry ? null : 3,
  });
}

/**
 * Creates a dedicated subscriber client.
 * A subscriber client cannot issue regular commands while subscribed.
 */
export function createSubscriber(): IORedis {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null });
}

// ─── Event helpers ────────────────────────────────────────────────────────────

/**
 * Publish a pipeline event to the Redis pub/sub channel for this run,
 * and append it to the persistent event list for late-join hydration.
 */
export async function emitEvent(
  redis: IORedis,
  event: PipelineEvent,
): Promise<void> {
  const payload = JSON.stringify(event);
  await Promise.all([
    redis.publish(keys.eventChannel(event.runId), payload),
    // Prepend so LRANGE 0 -1 returns newest-first; caller reverses if needed
    redis.rpush(keys.eventList(event.runId), payload),
    // Expire event list after 48h to avoid stale data accumulation
    redis.expire(keys.eventList(event.runId), 60 * 60 * 48),
  ]);
}

/**
 * Read all past events for a run (oldest first).
 * Used for hydrating clients that connect after events have already fired.
 */
export async function readEvents(
  redis: IORedis,
  runId: string,
): Promise<PipelineEvent[]> {
  const raw = await redis.lrange(keys.eventList(runId), 0, -1);
  return raw.map((r) => JSON.parse(r) as PipelineEvent);
}

// ─── Result helpers ───────────────────────────────────────────────────────────

/**
 * Store the final RunResult in Redis (48h TTL).
 */
export async function storeResult(
  redis: IORedis,
  runId: string,
  result: RunResult,
): Promise<void> {
  await redis.set(
    keys.result(runId),
    JSON.stringify(result),
    "EX",
    60 * 60 * 48,
  );
}

/**
 * Read the final RunResult for a run. Returns null if not yet available.
 */
export async function readResult(
  redis: IORedis,
  runId: string,
): Promise<RunResult | null> {
  const raw = await redis.get(keys.result(runId));
  if (!raw) return null;
  return JSON.parse(raw) as RunResult;
}
