/** @format */

"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useRunStore } from "@/store/runStore";
import { useRunEvents } from "@/lib/useRunEvents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PIPELINE_STAGES,
  type PipelineStage,
  type EventStatus,
} from "@rift/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<PipelineStage, string> = {
  INIT: "Init",
  CLONE_REPO: "Clone Repo",
  DETECT_ENV: "Detect Env",
  INSTALL_DEPS: "Install Deps",
  RUN_TESTS: "Run Tests",
  PARSE_FAILURES: "Parse Failures",
  APPLY_DETERMINISTIC_FIXES: "Apply Fixes",
  APPLY_AI_FIX: "AI Fix",
  COMMIT_CHANGES: "Commit",
  RETEST: "Retest",
  DONE: "Done",
  FAILED: "Failed",
};

function statusVariant(
  status: EventStatus | "PENDING" | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status || status === "PENDING") return "outline";
  if (status === "COMPLETED") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

function statusLabel(status: EventStatus | "PENDING" | undefined): string {
  if (!status || status === "PENDING") return "Pending";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ runId: string }>;
}

export default function RunPage({ params }: Props) {
  const { runId } = use(params);
  const router = useRouter();

  // Subscribe to live events
  useRunEvents(runId);

  const events = useRunStore((s) => s.events);
  const stageStates = useRunStore((s) => s.stageStates);
  const wsStatus = useRunStore((s) => s.wsStatus);
  const result = useRunStore((s) => s.result);

  const isDone =
    stageStates["DONE"]?.status === "COMPLETED" ||
    stageStates["FAILED"]?.status === "FAILED";

  return (
    <main className="min-h-screen bg-background p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Live Run</h1>
          <p className="text-muted-foreground text-xs font-mono mt-0.5">
            {runId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={wsStatus === "connected" ? "default" : "outline"}>
            {wsStatus}
          </Badge>
          {isDone && (
            <Button
              size="sm"
              onClick={() => router.push(`/run/${runId}/results`)}
            >
              View Results →
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stage timeline */}
        <Card className="md:col-span-1 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold mb-1">Pipeline Stages</h2>
          {PIPELINE_STAGES.map((stage) => {
            const state = stageStates[stage];
            return (
              <div
                key={stage}
                className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0"
              >
                <Badge
                  variant={statusVariant(state?.status)}
                  className="text-xs w-20 justify-center shrink-0"
                >
                  {statusLabel(state?.status)}
                </Badge>
                <span className="text-xs">{STAGE_LABELS[stage]}</span>
              </div>
            );
          })}
        </Card>

        {/* Live event log */}
        <Card className="md:col-span-2 p-4 flex flex-col gap-2 overflow-hidden">
          <h2 className="text-sm font-semibold">Event Stream</h2>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-130 font-mono text-xs">
            {events.length === 0 && (
              <span className="text-muted-foreground">Waiting for events…</span>
            )}
            {events.map((ev, i) => (
              <div
                key={i}
                className={`flex gap-2 py-0.5 ${
                  ev.status === "FAILED"
                    ? "text-destructive"
                    : ev.status === "COMPLETED"
                      ? "text-green-500"
                      : "text-foreground"
                }`}
              >
                <span className="text-muted-foreground shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-semibold shrink-0">{ev.stage}</span>
                <span className="opacity-70">{ev.status}</span>
                <span className="truncate">{ev.message}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick stats bar */}
      {result && (
        <Card className="p-4 flex items-center gap-6">
          <div className="text-sm">
            Status:{" "}
            <Badge
              variant={result.status === "PASSED" ? "default" : "destructive"}
            >
              {result.status}
            </Badge>
          </div>
          <div className="text-sm">
            Failures detected: <strong>{result.totalFailuresDetected}</strong>
          </div>
          <div className="text-sm">
            Fixes applied: <strong>{result.totalFixesApplied}</strong>
          </div>
          <div className="text-sm">
            Score: <strong>{result.score.total}</strong>
          </div>
        </Card>
      )}
    </main>
  );
}
