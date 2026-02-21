/** @format */

import { emitEvent as _emitEvent } from "@rift/redis";
import type { PipelineEvent, PipelineStage, EventStatus } from "@rift/types";
import type IORedis from "ioredis";

// ─── Re-export for convenience ────────────────────────────────────────────────

export { _emitEvent as emitEvent };

// ─── Helper: build and emit a stage event in one call ─────────────────────────

export async function emit(
  redis: IORedis,
  runId: string,
  stage: PipelineStage,
  status: EventStatus,
  message: string,
  data?: unknown,
): Promise<void> {
  const event: PipelineEvent = {
    runId,
    stage,
    status,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
  await _emitEvent(redis, event);
}
