/** @format */

import { createClient, createSubscriber, readEvents, keys } from "@rift/redis";
import type { PipelineEvent } from "@rift/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Stream already closed — ignore
        }
      };

      // 1. Flush all past events stored in Redis list (hydrates late-joining clients)
      const reader = createClient();
      try {
        const past = await readEvents(reader, runId);
        for (const event of past) send(event);
      } finally {
        reader.disconnect();
      }

      // 2. Subscribe to the Redis pub/sub channel for live events
      const sub = createSubscriber();
      await sub.subscribe(keys.eventChannel(runId));

      sub.on("message", (_channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as PipelineEvent;
          send(event);

          // Close the stream once the run reaches a terminal stage
          if (
            event.stage === "DONE" ||
            (event.stage === "FAILED" && event.status === "FAILED")
          ) {
            sub.disconnect();
            try {
              controller.close();
            } catch {}
          }
        } catch {
          // Malformed message — ignore
        }
      });

      sub.on("error", (err: Error) => {
        console.error(`[SSE:${runId}] Redis subscriber error:`, err);
        sub.disconnect();
        try {
          controller.close();
        } catch {}
      });

      // 3. Clean up subscriber when client disconnects
      req.signal.addEventListener("abort", () => {
        sub.disconnect();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering on Vercel edge
    },
  });
}
