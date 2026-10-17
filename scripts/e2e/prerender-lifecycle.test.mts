import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TERMINATION_EXIT_CODE = 143;
const lifecycleUrl = new URL("prerender-lifecycle.mts", import.meta.url).href;

/** Real parent-only signals exercise cancellation without signalling Vitest or any app stack. */
function startSupervisor({ file, stage }: { file: string; stage: string }) {
  const source = `
    import { readFile, writeFile } from 'node:fs/promises';
    import { withPrerenderCancellation } from ${JSON.stringify(lifecycleUrl)};
    const path = ${JSON.stringify(file)};
    await withPrerenderCancellation(async signal => {
      const previous = await readFile(path, 'utf8');
      try {
        if (${JSON.stringify(stage)} === 'before-main') await writeFile(path, 'temporary-api-url');
        process.stdout.write('STARTUP_PENDING\\n');
        signal.addEventListener('abort', () => process.stdout.write('CANCEL_RECEIVED\\n'));
        await new Promise(resolve => process.stdin.once('data', resolve));
        signal.throwIfAborted();
        process.stdout.write('MAIN_STARTED\\n');
      } finally {
        await writeFile(path, previous);
        process.stdout.write('CLEANED\\n');
      }
    });
  `;

  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const ready = Promise.withResolvers<null>();
  const cancelled = Promise.withResolvers<null>();
  const output = { text: "" };

  child.stdout.on("data", (chunk: Buffer) => {
    output.text += chunk.toString();

    if (output.text.includes("STARTUP_PENDING")) {
      ready.resolve(null);
    }

    if (output.text.includes("CANCEL_RECEIVED")) {
      cancelled.resolve(null);
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    output.text += chunk.toString();
  });

  child.once("error", ready.reject);
  child.once("close", () => ready.reject(new Error("Supervisor exited before pending startup")));
  return { cancelled: cancelled.promise, child, output, ready: ready.promise };
}

describe("prerender supervisor cancellation", () => {
  it.each(["api-start", "before-main"])(
    "cleans up and skips Main after cancellation in %s",
    async (stage) => {
      const directory = await mkdtemp(join(tmpdir(), "zoonk-prerender-cancellation-"));
      const file = join(directory, "environment");
      await writeFile(file, "original-api-url");
      const { cancelled, child, output, ready } = startSupervisor({ file, stage });

      const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          child.once("close", (code, signal) => {
            resolve({ code, signal });
          });
        },
      );

      try {
        await ready;
        child.kill("SIGTERM");
        await cancelled;
        child.stdin.end("startup-settled");
        const { code, signal } = await exited;
        expect(code).toBe(TERMINATION_EXIT_CODE);
        expect(signal).toBeNull();
        expect(output.text).toContain("CLEANED");
        expect(output.text).not.toContain("MAIN_STARTED");
        await expect(readFile(file, "utf8")).resolves.toBe("original-api-url");
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");

          if (!child.stdin.writableEnded) {
            child.stdin.end("cleanup");
          }
        }

        await exited;
        await rm(directory, { force: true, recursive: true });
      }
    },
  );
});
