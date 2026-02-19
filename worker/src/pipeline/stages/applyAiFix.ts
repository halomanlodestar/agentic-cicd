/** @format */

import type { PipelineContext } from "../context.ts";
import { emit } from "../../emit.ts";
import { applyAiFix } from "@rift/llm";

/**
 * APPLY_AI_FIX: Calls Grok (xAI) to fix any failures that deterministic tools
 * couldn't resolve. No-ops silently if XAI_API_KEY is unset.
 */
export async function stageApplyAiFix(ctx: PipelineContext): Promise<void> {
  if (!process.env.XAI_API_KEY) return; // skip cleanly when key not configured
  if (ctx.failures.length === 0) return;

  await emit(
    ctx.redis,
    ctx.runId,
    "APPLY_AI_FIX",
    "STARTED",
    `Sending ${ctx.failures.length} failure(s) to Gemini`,
  );

  const records = await applyAiFix(ctx.failures, ctx.workspacePath);
  ctx.fixes.push(...records);

  const fixed = records.filter((r) => r.status === "fixed").length;

  await emit(
    ctx.redis,
    ctx.runId,
    "APPLY_AI_FIX",
    fixed > 0 ? "COMPLETED" : "SKIPPED",
    fixed > 0 ? `Gemini fixed ${fixed} issue(s)` : "Gemini made no changes",
    { records },
  );
}
