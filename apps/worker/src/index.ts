/** @format */

import { Worker } from "bullmq";
import { runPipeline } from "./pipeline/index";

// ─── Config ───────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker("pipeline", runPipeline, {
  connection: {
    url: REDIS_URL,
    maxRetriesPerRequest: null,
  },
  concurrency: CONCURRENCY,
});

// ─── Logging ──────────────────────────────────────────────────────────────────

worker.on("active", (job) => {
  console.log(`[worker] Job ${job.id} started — runId: ${job.data.runId}`);
});

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed — runId: ${job.data.runId}`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[worker] Job ${job?.id} failed — runId: ${job?.data.runId}`,
    err.message,
  );
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`[worker] Received ${signal} — shutting down gracefully`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log(
  `[worker] Started — listening on queue "pipeline" (concurrency: ${CONCURRENCY})`,
);
