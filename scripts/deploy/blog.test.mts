import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { deployBlog } from "./blog.mts";

beforeEach(() => {
  vi.stubEnv("VERCEL_TOKEN", "test-vercel-token");
  vi.stubEnv("VERCEL_ORG_ID", "test-team");
  vi.stubEnv("VERCEL_PROJECT_ID_BLOG", "blog-project");
  vi.stubEnv("GH_TOKEN", "test-github-token");
  vi.stubEnv("GITHUB_REPOSITORY", "zoonk/zoonk");
  vi.stubEnv("GITHUB_REPOSITORY_ID", "924786497");
  vi.stubEnv("DEPLOY_SHA", "pushed-sha");
  vi.stubEnv("DEPLOY_REF", "main");
  vi.stubEnv("PR_NUMBER", "42");
  vi.stubEnv("GITHUB_STEP_SUMMARY", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function intercept({
  prState = "open",
  readyState,
}: {
  prState?: string;
  readyState: string;
}): Record<string, unknown>[] {
  const submissions: Record<string, unknown>[] = [];

  vi.stubGlobal("fetch", (url: URL, init: RequestInit) => {
    if (url.hostname === "api.github.com") {
      return Promise.resolve(Response.json({ state: prState }));
    }

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
    const submissions = intercept({ readyState: "READY" });
    await deployBlog("production");

    expect(submissions).toHaveLength(1);

    expect(submissions[0]).toMatchObject({
      gitSource: { ref: "main", repoId: "924786497", sha: "pushed-sha", type: "github" },
      project: "blog-project",
      target: "production",
    });
  });

  it("deploys an open PR's commit as a preview, never to production", async () => {
    vi.stubEnv("DEPLOY_REF", "cw/new-post");
    const submissions = intercept({ readyState: "READY" });
    await deployBlog("preview");

    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({ gitSource: { ref: "cw/new-post", sha: "pushed-sha" } });
    expect(submissions[0]).not.toHaveProperty("target");
  });

  it("starts no preview for a closed PR", async () => {
    const submissions = intercept({ prState: "closed", readyState: "READY" });
    await expect(deployBlog("preview")).rejects.toThrow("closed");
    expect(submissions).toHaveLength(0);
  });

  it("fails when Vercel can't build it", async () => {
    intercept({ readyState: "ERROR" });
    await expect(deployBlog("production")).rejects.toThrow("Vercel blog deployment failed: ERROR");
  });
});
