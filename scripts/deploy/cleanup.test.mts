import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Closed PR cleanup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PR_NUMBER", "42");
    vi.stubEnv("GITHUB_REPOSITORY", "zoonk/zoonk");
    vi.stubEnv("GH_TOKEN", "test-github-token");
    vi.stubEnv("VERCEL_TOKEN", "test-vercel-token");
    vi.stubEnv("VERCEL_ORG_ID", "test-team");
    vi.stubEnv("VERCEL_PROJECT_ID_API", "api-project");
    vi.stubEnv("VERCEL_PROJECT_ID_MAIN", "main-project");
    vi.stubEnv("VERCEL_PROJECT_ID_ADMIN", "admin-project");
    vi.stubEnv("NEON_API_KEY", "test-neon-key");
    vi.stubEnv("NEON_PROJECT_ID", "test-project");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(["closed", "open"])("rechecks PR state before deleting its branch: %s", async (state) => {
    const deletions: string[] = [];
    const prReads: URL[] = [];

    // Closing a PR deletes a database; intercept only the external provider boundaries.
    vi.stubGlobal("fetch", (url: URL, init: RequestInit) => {
      if (url.hostname === "api.github.com") {
        prReads.push(url);
        return Promise.resolve(Response.json({ state: prReads.length === 1 ? "closed" : state }));
      }

      if (url.hostname === "api.vercel.com") {
        return Promise.resolve(Response.json({ deployments: [], pagination: { next: null } }));
      }

      if (init.method === "DELETE") {
        deletions.push(url.pathname);
        return Promise.resolve(Response.json({}));
      }

      return Promise.resolve(
        Response.json({ branches: [{ id: "br-preview", name: "preview/pr-42" }] }),
      );
    });

    await import("./cleanup.mts");
    expect(prReads).toHaveLength(2);
    expect(deletions).toHaveLength(state === "closed" ? 1 : 0);
  });
});
