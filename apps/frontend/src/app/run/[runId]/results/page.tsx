/** @format */

import { notFound } from "next/navigation";
import Link from "next/link";
import { getRunResult } from "@/actions/runs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PIPELINE_STAGES, type PipelineStage } from "@rift/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<PipelineStage, string> = {
  INIT: "Init",
  CLONE_REPO: "Clone Repo",
  DETECT_ENV: "Detect Env",
  INSTALL_DEPS: "Install Deps",
  RUN_TESTS: "Run Tests",
  PARSE_FAILURES: "Parse Failures",
  APPLY_DETERMINISTIC_FIXES: "Apply Deterministic Fixes",
  APPLY_AI_FIX: "AI Fix",
  COMMIT_CHANGES: "Commit Changes",
  RETEST: "Retest",
  DONE: "Done",
  FAILED: "Failed",
};

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ runId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { runId } = await params;
  const result = await getRunResult(runId);

  if (!result) notFound();

  const { score } = result;

  return (
    <main className="min-h-screen bg-background p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Results</h1>
          <p className="text-muted-foreground text-xs font-mono mt-0.5">
            {runId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={result.status === "PASSED" ? "default" : "destructive"}
            className="text-sm px-3 py-1"
          >
            {result.status}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">← New Run</Link>
          </Button>
        </div>
      </div>

      {/* Panel 1: Run Summary */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Run Summary</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Team</dt>
            <dd className="font-medium">{result.teamName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Leader</dt>
            <dd className="font-medium">{result.leaderName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Branch</dt>
            <dd className="font-mono text-xs truncate">
              {result.branchName || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Duration</dt>
            <dd className="font-medium">{fmt(result.durationMs)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Commits</dt>
            <dd className="font-medium">{score.commitCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Iterations</dt>
            <dd className="font-medium">{result.iterations.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Failures Detected</dt>
            <dd className="font-medium">{result.totalFailuresDetected}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Fixes Applied</dt>
            <dd className="font-medium">{result.totalFixesApplied}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Repo</dt>
            <dd className="font-mono text-xs truncate">
              <a
                href={result.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {result.repoUrl}
              </a>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Panel 2: Stage Timeline */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Stage Timeline</h2>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_STAGES.map((stage) => {
            const iter = result.iterations.at(-1);
            const passed = iter?.passed ?? result.status === "PASSED";
            const isTerminal = stage === "DONE" || stage === "FAILED";
            const reached =
              !isTerminal ||
              (stage === "DONE" && passed) ||
              (stage === "FAILED" && !passed);
            return (
              <div
                key={stage}
                className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                  !reached
                    ? "border-border/30 text-muted-foreground"
                    : !passed && stage === "FAILED"
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-green-500/40 bg-green-500/10 text-green-600"
                }`}
              >
                <span>{STAGE_LABELS[stage]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Panel 3: Detected Failures */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">
          Detected Failures ({result.totalFailuresDetected})
        </h2>
        {result.failureDetails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failures detected.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="py-1.5 text-left font-medium pr-4">File</th>
                  <th className="py-1.5 text-left font-medium pr-4">Line</th>
                  <th className="py-1.5 text-left font-medium pr-4">Type</th>
                  <th className="py-1.5 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {result.failureDetails.map((f, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 font-mono pr-4 truncate max-w-45">
                      {f.file}
                    </td>
                    <td className="py-1 pr-4">{f.line}</td>
                    <td className="py-1 pr-4">
                      <Badge variant="outline" className="text-xs">
                        {f.bugType}
                      </Badge>
                    </td>
                    <td className="py-1 text-muted-foreground truncate max-w-70">
                      {f.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Panel 4: Applied Fixes */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">
          Applied Fixes ({result.totalFixesApplied})
        </h2>
        {result.fixes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fixes recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="py-1.5 text-left font-medium pr-4">
                    Strategy
                  </th>
                  <th className="py-1.5 text-left font-medium pr-4">File</th>
                  <th className="py-1.5 text-left font-medium pr-4">Type</th>
                  <th className="py-1.5 text-left font-medium pr-4">Status</th>
                  <th className="py-1.5 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {result.fixes.map((fix, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 pr-4">
                      <Badge variant="secondary" className="text-xs">
                        {fix.strategy}
                      </Badge>
                    </td>
                    <td className="py-1 font-mono pr-4 truncate max-w-37.5">
                      {fix.file}
                    </td>
                    <td className="py-1 pr-4">
                      <Badge variant="outline" className="text-xs">
                        {fix.bugType}
                      </Badge>
                    </td>
                    <td className="py-1 pr-4">
                      <Badge
                        variant={
                          fix.status === "fixed" ? "default" : "destructive"
                        }
                        className="text-xs"
                      >
                        {fix.status}
                      </Badge>
                    </td>
                    <td className="py-1 text-muted-foreground truncate max-w-65">
                      {fix.commitMessage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Panel 5: Score Breakdown */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Score Breakdown</h2>
        <div className="flex flex-col gap-2 max-w-xs">
          <div className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
            <span>Base score</span>
            <span className="font-mono">+{score.base}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
            <span>
              Speed bonus{" "}
              <span className="text-muted-foreground text-xs">({"<"}5min)</span>
            </span>
            <span
              className={`font-mono ${score.speedBonus > 0 ? "text-green-500" : "text-muted-foreground"}`}
            >
              +{score.speedBonus}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
            <span>
              Commit penalty{" "}
              <span className="text-muted-foreground text-xs">
                (-2 each over 20)
              </span>
            </span>
            <span
              className={`font-mono ${score.commitPenalty > 0 ? "text-destructive" : "text-muted-foreground"}`}
            >
              -{score.commitPenalty}
            </span>
          </div>
          <div className="flex items-center justify-between text-base font-bold pt-1">
            <span>Total</span>
            <span className="font-mono text-xl">{score.total}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Duration: {fmt(score.durationMs)} · {score.commitCount} commit(s)
          </p>
        </div>
      </Card>
    </main>
  );
}
