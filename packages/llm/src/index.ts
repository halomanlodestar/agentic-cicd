/** @format */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { Failure, FixRecord } from "@rift/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL = "gemini-2.0-flash";

// ─── Gemini response schema ───────────────────────────────────────────────────

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    files: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          path: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING },
        },
        required: ["path", "content"],
      },
    },
  },
  required: ["files"],
};

interface GeminiResponse {
  files: Array<{ path: string; content: string }>;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calls Gemini to fix any remaining failures that deterministic tools couldn't
 * handle (LOGIC, TYPE_ERROR, complex LINTING, etc.).
 *
 * Reads file contents from the host workspace (bind-mounted into the Docker
 * container), sends everything in a single API call, writes fixed files back.
 * The running DockerSession will see the changes immediately via the bind mount.
 *
 * Returns an empty array (no-op) if GEMINI_API_KEY is unset or no failures remain.
 */
export async function applyAiFix(
  failures: Failure[],
  workspacePath: string,
): Promise<FixRecord[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || failures.length === 0) return [];

  // ── Group failures by file ──────────────────────────────────────────────
  const byFile = new Map<string, Failure[]>();
  for (const f of failures) {
    const existing = byFile.get(f.file) ?? [];
    existing.push(f);
    byFile.set(f.file, existing);
  }

  // ── Read current file contents (post-deterministic-fix) ────────────────
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

  // ── Build prompt ────────────────────────────────────────────────────────
  const prompt = [
    "You are an expert Python developer. Fix ALL listed issues in each file.",
    "Rules:",
    "- Return complete, valid Python files (no truncation, no ellipsis).",
    "- Do NOT add explanatory comments about your changes.",
    "- Preserve all existing logic and behaviour — only fix the listed issues.",
    "- If a variable is assigned but never used, either use it or delete the assignment.",
    "- If an import is unused, remove it.",
    "- You MUST add a comment like '# [AI FIX] Explaination' on each line you change, so we can track what you fixed.",
    "",
    ...fileContexts,
    "",
    'Return a JSON object with a "files" array. Each entry: { "path": "<original path>", "content": "<complete fixed Python source>" }',
  ].join("\n");

  // ── Call Gemini ─────────────────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let response: GeminiResponse;
  try {
    const result = await model.generateContent(prompt);
    response = JSON.parse(result.response.text()) as GeminiResponse;
  } catch (err) {
    console.warn("[llm] Gemini call failed:", err);
    return []; // non-fatal — pipeline continues with what deterministic fixes did
  }

  // ── Write fixed files back to host workspace ────────────────────────────
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

      console.log(`[llm] Fixed ${filePath} (${fileFails.length} issue(s))`);
    } catch {
      // write failed — skip silently
    }
  }

  return records;
}
