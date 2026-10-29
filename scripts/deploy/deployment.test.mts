import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PROJECTS } from "./config.mts";
import { assertCurrentPreview, cancelPreviews, deploy, getAppUrl } from "./deployment.mts";

type Call = { url: URL; body: Record<string, unknown>; method: string };

beforeEach(() => {
  vi.stubEnv("VERCEL_TOKEN", "test-vercel-token");
  vi.stubEnv("VERCEL_ORG_ID", "test-team");
  vi.stubEnv("VERCEL_PROJECT_ID_API", "api-project");
  vi.stubEnv("VERCEL_PROJECT_ID_MAIN", "main-project");
  vi.stubEnv("VERCEL_PROJECT_ID_ADMIN", "admin-project");
  vi.stubEnv("GH_TOKEN", "test-github-token");
  vi.stubEnv("GITHUB_REPOSITORY", "zoonk/zoonk");
  vi.stubEnv("GITHUB_REPOSITORY_ID", "924786497");
  vi.stubEnv("GITHUB_RUN_ID", "100");
  vi.stubEnv("GITHUB_RUN_ATTEMPT", "1");
  vi.stubEnv("DEPLOY_SHA", "tested-sha");
  vi.stubEnv("DEPLOY_REF", "main");
  vi.stubEnv("PR_NUMBER", "42");
  vi.stubEnv("DATABASE_URL", "postgresql://pr-database");
  vi.stubEnv("DATABASE_URL_UNPOOLED", "postgresql://pr-database-direct");
  vi.stubEnv("GITHUB_STEP_SUMMARY", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function intercept(handler: (call: Call) => unknown): undefined {
  vi.stubGlobal("fetch", (url: URL, init: RequestInit) => {
    const value = handler({
      body: z
        .record(z.string(), z.unknown())
        .parse(JSON.parse(typeof init.body === "string" ? init.body : "{}")),
      method: init.method ?? "GET",
      url,
    });

    return Promise.resolve(value).then((body) => Response.json(body));
  });
}

describe(deploy, () => {
  it("starts every production build before waiting for any one build to succeed", async () => {
    const submissions: Call[] = [];
    const barrier = Promise.withResolvers<boolean>();

    intercept(async (call) => {
      if (call.method === "POST") {
        submissions.push(call);

        if (submissions.length === PROJECTS.length) {
          barrier.resolve(true);
        }

        await barrier.promise;
        return { id: String(call.body.project) };
      }

      return { aliasAssigned: true, readyState: "READY", url: "production.vercel.app" };
    });

    await deploy("production");
    expect(submissions).toHaveLength(3);

    expect(submissions.map((call) => call.body.project)).toStrictEqual(
      PROJECTS.map((project) => project.id),
    );

    for (const call of submissions) {
      expect(call.body).toMatchObject({
        buildMachine: "turbo",
        gitSource: { ref: "main", sha: "tested-sha" },
        target: "production",
      });

      expect(call.url.searchParams.get("withCache")).toBe("1");
      expect(call.body).not.toHaveProperty("autoAssignCustomDomains", false);
      expect(call.body).not.toHaveProperty("customEnvironmentSlugOrId");
    }
  });

  it("starts every preview build at once, pointing each app at the others' branch URLs", async () => {
    const submissions: Call[] = [];
    const barrier = Promise.withResolvers<boolean>();

    intercept(async (call) => {
      if (call.url.hostname === "api.github.com") {
        return { head: { sha: "tested-sha" }, state: "open" };
      }

      if (call.url.pathname === "/v2/teams/test-team") {
        return { slug: "zoonk" };
      }

      if (call.method === "POST") {
        submissions.push(call);

        if (submissions.length === PROJECTS.length) {
          barrier.resolve(true);
        }

        await barrier.promise;
        return { id: String(call.body.project) };
      }

      return { readyState: "READY", url: "preview.vercel.app" };
    });

    await deploy("preview");
    expect(submissions).toHaveLength(3);

    for (const call of submissions) {
      expect(call.body.env).toMatchObject({
        DATABASE_URL: "postgresql://pr-database",
        DATABASE_URL_UNPOOLED: "postgresql://pr-database-direct",
        NEXT_PUBLIC_APP_DOMAIN: "",
      });

      expect(call.body.build).toStrictEqual({ env: call.body.env });
      expect(call.url.searchParams.get("withCache")).toBe("1");
      expect(call.body).not.toHaveProperty("buildMachine");
    }

    const [api, ...clients] = submissions;

    expect(api?.body.env).toMatchObject({
      MAIN_APP_URL: "https://zoonk-git-main-zoonk.vercel.app",
      NEXT_PUBLIC_API_URL: "",
    });

    for (const call of clients) {
      expect(call.body.env).toHaveProperty(
        "NEXT_PUBLIC_API_URL",
        "https://zoonk-api-git-main-zoonk.vercel.app",
      );

      expect(call.body.env).not.toHaveProperty("MAIN_APP_URL");
    }
  });

  it("waits for the API preview's actual URL when its branch URL can't be predicted", async () => {
    vi.stubEnv("DEPLOY_REF", "a".repeat(60));

    const submissions: Call[] = [];
    const ready = new Set<string>();

    intercept((call) => {
      if (call.url.hostname === "api.github.com") {
        return { head: { sha: "tested-sha" }, state: "open" };
      }

      if (call.url.pathname === "/v2/teams/test-team") {
        return { slug: "zoonk" };
      }

      if (call.method === "POST") {
        if (call.body.project !== PROJECTS[0].id && !ready.has(PROJECTS[0].id)) {
          throw new Error("Consumer deployed before the API was ready");
        }

        submissions.push(call);
        return { id: String(call.body.project) };
      }

      const id = call.url.pathname.split("/").at(-1) ?? "";
      ready.add(id);
      return { readyState: "READY", url: `${id}.vercel.app` };
    });

    await deploy("preview");
    expect(submissions).toHaveLength(3);

    for (const call of submissions.slice(1)) {
      expect(call.body.env).toHaveProperty(
        "NEXT_PUBLIC_API_URL",
        `https://${PROJECTS[0].id}.vercel.app`,
      );
    }

    expect(submissions[0]?.body.env).not.toHaveProperty("MAIN_APP_URL");
  });

  it.each([
    { target: "production", url: "https://www.zoonk.com" },
    { target: "staging", url: "https://main.zoonk.dev" },
  ] as const)("points the $target API at the $target main app", async ({ target, url }) => {
    const submissions: Call[] = [];

    intercept((call) => {
      if (call.method === "POST") {
        submissions.push(call);
        return { id: String(call.body.project) };
      }

      return { aliasAssigned: true, readyState: "READY", url: `${target}.vercel.app` };
    });

    await deploy(target);

    const [api, ...clients] = submissions;
    expect(api?.body.env).toHaveProperty("MAIN_APP_URL", url);

    for (const call of clients) {
      expect(call.body.env).not.toHaveProperty("MAIN_APP_URL");
    }
  });

  it.each(["ERROR", "BLOCKED", "CANCELED"])(
    "reports a %s production app after the remaining builds have completed",
    async (state) => {
      const completed: string[] = [];

      intercept((call) => {
        if (call.method === "POST") {
          return { id: String(call.body.project) };
        }

        const id = call.url.pathname.split("/").at(-1) ?? "";
        completed.push(id);

        return {
          aliasAssigned: true,
          readyState: id === PROJECTS[0].id ? state : "READY",
          url: `${id}.vercel.app`,
        };
      });

      await expect(deploy("production")).rejects.toThrow("1 production deployment(s) failed");
      expect(completed).toHaveLength(3);
    },
  );
});

describe(cancelPreviews, () => {
  it("cancels only this run's PR builds, including later result pages", async () => {
    const canceled: string[] = [];

    intercept((call) => {
      if (call.method === "PATCH") {
        canceled.push(call.url.pathname);
        return {};
      }

      if (call.url.searchParams.has("until")) {
        return {
          deployments: [{ meta: { ciPreviewPr: "42", ciRunId: "100-1" }, uid: "old-page-2" }],
          pagination: { next: null },
        };
      }

      return {
        deployments: [
          { meta: { ciPreviewPr: "42", ciRunId: "100-1" }, uid: "old" },
          { meta: { ciPreviewPr: "42", ciRunId: "101-1" }, uid: "new" },
          { meta: { ciPreviewPr: "43", ciRunId: "100-1" }, uid: "other-pr" },
          { meta: { ciPreviewPr: "42", ciRunId: "100-1" }, target: "production", uid: "prod" },
        ],
        pagination: { next: 123 },
      };
    });

    await cancelPreviews({ runId: "100-1" });
    expect(canceled).toHaveLength(PROJECTS.length * 2);
    expect(canceled.every((path) => /\/(?:old|old-page-2)\/cancel$/u.test(path))).toBe(true);
  });
});

describe(assertCurrentPreview, () => {
  it.each([
    { head: { sha: "tested-sha" }, state: "closed" },
    { head: { sha: "newer-sha" }, state: "open" },
  ])("rejects an obsolete preview: $state / $head.sha", async (pr) => {
    intercept(() => pr);
    await expect(assertCurrentPreview()).rejects.toThrow("superseded");
  });
});

describe(getAppUrl, () => {
  it("builds a preview app's address from Vercel's branch URL pattern", () => {
    expect(
      getAppUrl({ app: "main", branch: "feat/Learning_v2", target: "preview", teamSlug: "zoonk" }),
    ).toBe("https://zoonk-git-feat-learning-v2-zoonk.vercel.app");

    expect(
      getAppUrl({ app: "api", branch: "learning-v2", target: "preview", teamSlug: "zoonk" }),
    ).toBe("https://zoonk-api-git-learning-v2-zoonk.vercel.app");
  });

  it("uses each app's own domain in production and staging", () => {
    expect(getAppUrl({ app: "admin", branch: "main", target: "production", teamSlug: "" })).toBe(
      "https://admin.zoonk.com",
    );

    expect(getAppUrl({ app: "api", branch: "main", target: "staging", teamSlug: "" })).toBe(
      "https://api.zoonk.dev",
    );
  });

  it("gives no preview address when Vercel would shorten it", () => {
    expect(
      getAppUrl({ app: "main", branch: "a".repeat(60), target: "preview", teamSlug: "zoonk" }),
    ).toBeNull();
  });
});
