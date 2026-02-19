/** @format */

import OpenAI from "openai";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { Failure, FixRecord } from "@rift/types";

// ─── Config ───────────────────────────────────────────────────────────────────

interface AiResponse {
  files: Array<{ path: string; content: string }>;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calls Grok (xAI) to fix any remaining failures that deterministic tools
 * couldn't handle (LOGIC, TYPE_ERROR, complex LINTING, etc.).
 *
 * Grok exposes an OpenAI-compatible API — we reuse the `openai` SDK with a
 * custom baseURL. JSON mode guarantees a parseable response.
 *
 * Reads file contents from the host workspace (bind-mounted into Docker),
 * sends everything in one API call, writes fixed files back.
 * Returns an empty array (no-op) if XAI_API_KEY is unset or no failures remain.
 */
export async function applyAiFix(
  failures: Failure[],
  workspacePath: string,
): Promise<FixRecord[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || failures.length === 0) return [];

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  // ── Group failures by file ────────────────────────────────────────────────
  const byFile = new Map<string, Failure[]>();
  for (const f of failures) {
    const existing = byFile.get(f.file) ?? [];
    existing.push(f);
    byFile.set(f.file, existing);
  }

  // ── Read current file contents (post-deterministic-fix) ──────────────────
  const fileContexts: string[] = [];
  const readableFiles = new Set<string>();

  for (const [filePath, fileFails] of byFile) {
    const absPath = join(workspacePath, filePath);
    let content: string;
    try {
      content = await readFile(absPath, "utf8");
    } catch {
      continue; // unreadable — skip
    }
    readableFiles.add(filePath);

    const issueList = fileFails
      .map((f) => `  Line ${f.line}: [${f.bugType}] ${f.message}`)
      .join("\n");

    fileContexts.push(
      `### File: ${filePath}\n\`\`\`python\n${content}\n\`\`\`\n\nIssues to fix:\n${issueList}`,
    );
  }

  if (fileContexts.length === 0) return [];

  // ── Build prompt ──────────────────────────────────────────────────────────
  const userPrompt = [
    "You are an expert Python developer. Fix ALL listed issues in each file.",
    "Rules:",
    "- Return complete, valid Python files (no truncation, no ellipsis).",
    "- Do NOT add explanatory comments about your changes.",
    "- Preserve all existing logic and behaviour — only fix the listed issues.",
    "- If a variable is assigned but never used, either use it or delete the assignment.",
    "- If an import is unused, remove it.",
    "- Add a short inline comment '# [AI FIX]' on each line you change.",
    "",
    ...fileContexts,
    "",
    'Return ONLY a JSON object: { "files": [ { "path": "<original path>", "content": "<complete fixed Python source>" } ] }',
  ].join("\n");

  // ── Call Grok ─────────────────────────────────────────────────────────────
  let response: AiResponse;
  try {
    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a Python code repair agent. Always respond with valid JSON only.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    response = JSON.parse(raw) as AiResponse;
  } catch (err) {
    console.warn("[llm] Grok call failed:", err);
    return []; // non-fatal — pipeline continues with deterministic-only fixes
  }

  // ── Write fixed files back to host workspace ──────────────────────────────
  const records: FixRecord[] = [];

  for (const { path: filePath, content } of response.files ?? []) {
    if (!content?.trim() || !readableFiles.has(filePath)) continue;

    const absPath = join(workspacePath, filePath);
    try {
      await writeFile(absPath, content, "utf8");

      const fileFails = byFile.get(filePath) ?? [];
      for (const f of fileFails) {
        records.push({
          bugType: f.bugType,
          file: filePath,
          line: f.line,
          strategy: "ai",
          status: "fixed",
          commitMessage: `[AI] ${f.message.split(" ").slice(0, 6).join(" ")} in ${filePath}`,
        });
      }

      console.log(
        `[llm] Grok fixed ${filePath} (${byFile.get(filePath)?.length ?? 0} issue(s))`,
      );
    } catch {
      // write failed — skip silently
    }
  }

  return records;
}
