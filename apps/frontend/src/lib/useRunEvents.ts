/** @format */

"use client";

import { useEffect, useRef } from "react";
import type { PipelineEvent } from "@rift/types";
import { useRunStore } from "@/store/runStore";

function eventKey(e: PipelineEvent): string {
  return `${e.stage}:${e.status}:${e.timestamp}`;
}

/**
 * Opens an SSE connection to /api/events/:runId and streams PipelineEvents
 * into the Zustand store. Handles cleanup on unmount and terminal stages.
 *
 * Call this once from the Live Run page.
 */
export function useRunEvents(runId: string | null) {
  const appendEvent = useRunStore((s) => s.appendEvent);
  const setResult = useRunStore((s) => s.setResult);
  const setWsStatus = useRunStore((s) => s.setWsStatus);
  const esRef = useRef<EventSource | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!runId) return;

    seenRef.current = new Set();
    setWsStatus("connecting");

    const es = new EventSource(`/api/events/${runId}`);
    esRef.current = es;

    es.onopen = () => {
      setWsStatus("connected");
    };

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as PipelineEvent;
        const key = eventKey(event);

        // Deduplicate (guards against EventSource auto-reconnect sending duplicates)
        if (seenRef.current.has(key)) return;
        seenRef.current.add(key);

        appendEvent(event);

        // If the run result is embedded in the terminal event data, store it
        if (
          (event.stage === "DONE" || event.stage === "FAILED") &&
          event.status === "COMPLETED" &&
          event.data
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setResult(event.data as any);
        }

        // Close once terminal stage is received — no more events will come
        if (
          event.stage === "DONE" ||
          (event.stage === "FAILED" && event.status === "FAILED")
        ) {
          es.close();
          setWsStatus("closed");
        }
      } catch {
        // Malformed frame — ignore
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on error; reflect that in status
      setWsStatus("error");
    };

    return () => {
      es.close();
      esRef.current = null;
      setWsStatus("closed");
    };
  }, [runId, appendEvent, setResult, setWsStatus]);
}
