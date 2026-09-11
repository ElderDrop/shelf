import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ApiProvider, ProviderResponse } from "promptfoo";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type ProviderOptions = {
  id?: string;
  config?: {
    model?: string;
  };
};

/**
 * promptfoo provider that shells out to the same CLI used in CI.
 * Prompt text is treated as the unified diff (stdin).
 */
export default class CursorReviewProvider implements ApiProvider {
  providerId: string;
  private model: string;

  constructor(options: ProviderOptions) {
    this.model = options.config?.model?.trim() || "composer-2.5";
    this.providerId = options.id ?? `cursor-review:${this.model}`;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    const started = Date.now();
    const output = await new Promise<string>((resolvePromise, reject) => {
      const { GITHUB_ACTIONS: _ga, ...restEnv } = process.env;
      const child = spawn("npx", ["tsx", "src/review.ts"], {
        cwd: PKG_ROOT,
        env: {
          ...restEnv,
          CURSOR_REVIEW_MODEL: this.model,
          // Eval harness asserts on JSON; do not fail the process on verdict=fail
          // or promptfoo treats it as a provider error instead of a scored output.
          REVIEW_EXIT_ON_FAIL: "0",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(`review exited ${code}: ${stderr || stdout}`));
          return;
        }
        resolvePromise(stdout);
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });

    return {
      output: output.trim(),
      tokenUsage: {
        total: 0,
        cached: undefined,
      },
      cost: undefined,
      latencyMs: Date.now() - started,
    };
  }
}
