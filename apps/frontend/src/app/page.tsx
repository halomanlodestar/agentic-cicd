/** @format */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRun } from "@/actions/runs";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const router = useRouter();
  const setRunId = useRunStore((s) => s.setRunId);
  const reset = useRunStore((s) => s.reset);

  const [repoUrl, setRepoUrl] = useState("");
  const [teamName, setTeamName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      reset();
      const result = await startRun({ repoUrl, teamName, leaderName });
      if ("error" in result) {
        setError(result.error);
      } else {
        setRunId(result.runId);
        router.push(`/run/${result.runId}`);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RIFT 2026</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Autonomous CI/CD Healing Agent
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="repoUrl">Repository URL</Label>
            <Input
              id="repoUrl"
              type="url"
              placeholder="https://github.com/user/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              placeholder="TEAM_ALPHA"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leaderName">Leader Name</Label>
            <Input
              id="leaderName"
              placeholder="JOHN_DOE"
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={pending} className="w-full mt-2">
            {pending ? "Starting…" : "Run Agent"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
