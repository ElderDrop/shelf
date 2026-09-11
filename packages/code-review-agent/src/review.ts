import { Agent, CursorAgentError } from "@cursor/sdk";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReviewPrompt,
  parseReviewJson,
  type Review,
} from "./review-schema.ts";

const PACKAGE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(REPO_ROOT, ".env"));
loadEnvFile(resolve(PACKAGE_ROOT, ".env"));

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function readDiff(): Promise<string> {
  const fromEnv = process.env.REVIEW_DIFF;
  if (fromEnv && fromEnv.trim()) return fromEnv;

  const pathEnv = process.env.REVIEW_DIFF_PATH?.trim();
  if (pathEnv) {
    const abs = resolve(pathEnv.startsWith("/") ? pathEnv : resolve(REPO_ROOT, pathEnv));
    return readFileSync(abs, "utf8");
  }

  return readStdin();
}

function resolveChangeId(title: string, body: string): string | undefined {
  const explicit = process.env.REVIEW_CHANGE_ID?.trim();
  if (explicit) return explicit;

  const haystack = `${title}\n${body}`;
  const match =
    haystack.match(/context\/changes\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/i) ??
    haystack.match(/\bchange[_-]?id[:\s]+([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/i);
  return match?.[1];
}

function readPlan(changeId: string | undefined): string | undefined {
  if (!changeId) return undefined;
  const planPath = resolve(REPO_ROOT, "context/changes", changeId, "plan.md");
  if (!existsSync(planPath)) return undefined;
  try {
    return readFileSync(planPath, "utf8");
  } catch {
    return undefined;
  }
}

function writeGithubOutput(review: Review): void {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;

  const lines = [
    `verdict=${review.verdict}`,
    `implementationCorrectness=${review.implementationCorrectness}`,
    `idiomaticity=${review.idiomaticity}`,
    `complexity=${review.complexity}`,
    `testRiskCoverage=${review.testRiskCoverage}`,
    `securitySafety=${review.securitySafety}`,
    `summary<<SUMMARY_EOF`,
    review.summary,
    `SUMMARY_EOF`,
  ];
  appendFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
}

async function review(diff: string): Promise<Review> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Brak CURSOR_API_KEY. Ustaw klucz z https://cursor.com/dashboard/integrations (np. w .env).",
    );
  }

  if (!diff.trim()) {
    throw new Error("Pusty diff — podaj git diff na stdin, REVIEW_DIFF lub REVIEW_DIFF_PATH");
  }

  const title = process.env.PR_TITLE?.trim() ?? "";
  const body = process.env.PR_BODY?.trim() ?? "";
  const changeId = resolveChangeId(title, body);
  const plan = readPlan(changeId);
  const modelId = process.env.CURSOR_REVIEW_MODEL?.trim() || "composer-2.5";

  const prompt = buildReviewPrompt({ diff, title, body, plan });

  try {
    // systemPrompt wymaga osobnego dostępu na koncie; instrukcje wklejamy w prompt użytkownika.
    // tools: [] — wąski scorer; plan.md wstrzykujemy lokalnie gdy change-id jest znany.
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: modelId },
      tools: [],
      local: {
        cwd: REPO_ROOT,
        settingSources: [],
      },
    });

    if (result.status === "error") {
      throw new Error(
        `Review nie powiodło się: ${result.error?.message ?? "unknown"} (run ${result.id})`,
      );
    }
    if (result.status === "cancelled") {
      throw new Error(`Review anulowany (run ${result.id})`);
    }

    const text = result.result ?? "";
    if (!text.trim()) {
      throw new Error(`Agent nie zwrócił tekstu (run ${result.id})`);
    }

    if (process.env.CURSOR_REVIEW_DEBUG === "1" && result.usage) {
      console.error(
        `[usage] in=${result.usage.inputTokens} out=${result.usage.outputTokens} total=${result.usage.totalTokens}`,
      );
    }

    if (changeId && plan) {
      console.error(`[context] injected plan.md for change-id=${changeId}`);
    } else if (changeId) {
      console.error(`[context] change-id=${changeId} but plan.md not found`);
    }

    return parseReviewJson(text);
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(
        `Start agenta nieudany: ${err.message} (retryable=${err.isRetryable})`,
      );
    }
    throw err;
  }
}

const diff = await readDiff();
const output = await review(diff);
writeGithubOutput(output);
console.log(JSON.stringify(output, null, 2));
// In GitHub Actions the workflow gates on outputs.verdict after posting the comment.
// Locally / in promptfoo, fail the process so scripts and evals see a red signal.
const exitOnFail =
  process.env.REVIEW_EXIT_ON_FAIL === "1" ||
  (process.env.GITHUB_ACTIONS !== "true" && process.env.REVIEW_EXIT_ON_FAIL !== "0");
if (output.verdict === "fail" && exitOnFail) {
  process.exitCode = 1;
}
