import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { deployBlog } from "./blog.mts";

beforeEach(() => {
  vi.stubEnv("VERCEL_TOKEN", "test-vercel-token");
  vi.stubEnv("VERCEL_ORG_ID", "test-team");
  vi.stubEnv("VERCEL_PROJECT_ID_BLOG", "blog-project");
  vi.stubEnv("GITHUB_REPOSITORY_ID", "924786497");
  vi.stubEnv("DEPLOY_SHA", "pushed-sha");
  vi.stubEnv("DEPLOY_REF", "main");
  vi.stubEnv("GITHUB_STEP_SUMMARY", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function intercept(readyState: string): Record<string, unknown>[] {
  const submissions: Record<string, unknown>[] = [];

  vi.stubGlobal("fetch", (_url: URL, init: RequestInit) => {
    if (init.method === "POST") {
      submissions.push(
        z
          .record(z.string(), z.unknown())
          .parse(JSON.parse(typeof init.body === "string" ? init.body : "{}")),
      );

      return Promise.resolve(Response.json({ id: "blog-deployment" }));
    }

    return Promise.resolve(
      Response.json({ aliasAssigned: true, readyState, url: "blog.vercel.app" }),
    );
  });

  return submissions;
}

describe(deployBlog, () => {
  it("deploys the pushed commit to production and waits for its domain", async () => {
    const submissions = intercept("READY");
    await deployBlog();

    expect(submissions).toHaveLength(1);

    expect(submissions[0]).toMatchObject({
      gitSource: { ref: "main", repoId: "924786497", sha: "pushed-sha", type: "github" },
      project: "blog-project",
      target: "production",
    });
  });

  it("fails when Vercel can't build it", async () => {
    intercept("ERROR");
    await expect(deployBlog()).rejects.toThrow("Vercel blog deployment failed: ERROR");
  });
});
