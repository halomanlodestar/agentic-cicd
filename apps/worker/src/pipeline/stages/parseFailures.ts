/** @format */

import { parseFailures } from "@rift/parser";
import type { PipelineContext } from "../context";
import { emit } from "../../emit";
import type { TestRunResult } from "./runTests";

/** PARSE_FAILURES: Parses pytest + flake8 output into structured Failure objects. */
export async function stageParseFailures(
  ctx: PipelineContext,
  testResult: TestRunResult,
): Promise<void> {
  await emit(
    ctx.redis,
    ctx.runId,
    "PARSE_FAILURES",
    "STARTED",
    "Parsing test and lint output",
  );

  ctx.failures = parseFailures(testResult.rawPytest, testResult.rawFlake8);

  const byType = ctx.failures.reduce(
    (acc, f) => {
      acc[f.bugType] = (acc[f.bugType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const summary = Object.entries(byType)
    .map(([t, n]) => `${n} ${t}`)
    .join(", ");

  await emit(
    ctx.redis,
    ctx.runId,
    "PARSE_FAILURES",
    "COMPLETED",
    `${ctx.failures.length} failure(s) detected${ctx.failures.length ? ": " + summary : ""}`,
    ctx.failures,
  );
}
