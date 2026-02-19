/** @format */

import type { PipelineContext } from "../context";
import { emit } from "../../emit";
import type { TestRunResult } from "./runTests";

/** PARSE_FAILURES: Parses test/lint output into structured Failure objects. [Phase 5] */
export async function stageParseFailures(
  ctx: PipelineContext,
  _testResult: TestRunResult,
): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "PARSE_FAILURES",
    "STARTED",
    "Parsing failures",
  );
  // TODO Phase 5: @rift/parser
  ctx.failures = [];
  await emit(
    ctx.redis,
    ctx.runId,
    "PARSE_FAILURES",
    "COMPLETED",
    "0 failures parsed (stub)",
  );
}
