import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const directory = await mkdtemp(join(tmpdir(), "zoonk-ci-test-"));
const outputFile = join(directory, "output");

describe("Release CI reuse", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("GITHUB_REF", "refs/tags/v1.0.0");
    vi.stubEnv("GITHUB_SHA", "release-sha");
    vi.stubEnv("GITHUB_REPOSITORY", "zoonk/zoonk");
    vi.stubEnv("GITHUB_OUTPUT", outputFile);
    vi.stubEnv("GH_TOKEN", "test-github-token");
    await writeFile(outputFile, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await rm(directory, { recursive: true });
  });

  it.each([
    { conclusions: ["success"], required: false },
    { conclusions: [], required: true },
    { conclusions: ["failure", "success"], required: true },
  ])(
    "requires checks=$required for main CI results $conclusions",
    async ({ conclusions, required }) => {
      // GitHub's run API is an external boundary; no workflow is dispatched by these tests.
      vi.stubGlobal("fetch", (url: URL) => {
        expect(url.searchParams.get("head_sha")).toBe("release-sha");

        return Promise.resolve(
          Response.json({
            workflow_runs: conclusions.map((conclusion, index) => ({
              conclusion,
              event: "push",
              head_branch: "main",
              id: index,
              status: "completed",
            })),
          }),
        );
      });

      await import("./ci-required.mts");
      await expect(readFile(outputFile, "utf8")).resolves.toBe(`required=${required}\n`);
    },
  );
});
