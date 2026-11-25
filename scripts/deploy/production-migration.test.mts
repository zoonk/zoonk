import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { prepareProductionMigration } from "./production-migration.mts";

const RELEASING = "v2.4.1-sha";
const RUNNING = "v2.4.0-sha";

type Served = { createdAt: number; sha: string };

beforeEach(() => {
  vi.stubEnv("VERCEL_TOKEN", "test-vercel-token");
  vi.stubEnv("VERCEL_ORG_ID", "test-team");
  vi.stubEnv("VERCEL_PROJECT_ID_API", "api-project");
  vi.stubEnv("VERCEL_PROJECT_ID_MAIN", "main-project");
  vi.stubEnv("VERCEL_PROJECT_ID_ADMIN", "admin-project");
  vi.stubEnv("DEPLOY_SHA", RELEASING);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function serve(domains: Record<string, Served>): Record<string, unknown> {
  const boundaries: Record<string, unknown> = {};

  vi.stubGlobal("fetch", (url: URL, init: RequestInit) => {
    const target = url.pathname.split("/").at(-1) ?? "";

    if (init.method === "PATCH") {
      boundaries[target] = z
        .object({ skewProtectionBoundaryAt: z.number() })
        .parse(JSON.parse(typeof init.body === "string" ? init.body : "{}"));

      return Promise.resolve(Response.json({}));
    }

    const served = domains[target];

    return Promise.resolve(
      Response.json({
        createdAt: served?.createdAt,
        id: `${target}-deployment`,
        meta: { githubCommitSha: served?.sha },
      }),
    );
  });

  return boundaries;
}

describe(prepareProductionMigration, () => {
  it("stops open tabs reaching any deployment older than the one each production domain serves", async () => {
    const boundaries = serve({
      "admin.zoonk.com": { createdAt: 1_795_463_143_570, sha: RUNNING },
      "api.zoonk.com": { createdAt: 1_795_463_143_192, sha: RUNNING },
      "www.zoonk.com": { createdAt: 1_795_463_143_346, sha: RUNNING },
    });

    await prepareProductionMigration();

    expect(boundaries).toStrictEqual({
      "admin-project": { skewProtectionBoundaryAt: 1_795_463_143_570 },
      "api-project": { skewProtectionBoundaryAt: 1_795_463_143_192 },
      "main-project": { skewProtectionBoundaryAt: 1_795_463_143_346 },
    });
  });

  it("refuses to migrate while a failed release left one app on an older release", async () => {
    const boundaries = serve({
      "admin.zoonk.com": { createdAt: 3, sha: RUNNING },
      "api.zoonk.com": { createdAt: 2, sha: RUNNING },
      "www.zoonk.com": { createdAt: 1, sha: "v2.3.8-sha" },
    });

    await expect(prepareProductionMigration()).rejects.toThrow(/main v2\.3\.8-sha/u);
    expect(boundaries).toStrictEqual({});
  });

  it("lets a release run again after only some of its apps went live", async () => {
    const boundaries = serve({
      "admin.zoonk.com": { createdAt: 5, sha: RELEASING },
      "api.zoonk.com": { createdAt: 4, sha: RELEASING },
      "www.zoonk.com": { createdAt: 2, sha: RUNNING },
    });

    await prepareProductionMigration();

    expect(boundaries).toStrictEqual({
      "admin-project": { skewProtectionBoundaryAt: 5 },
      "api-project": { skewProtectionBoundaryAt: 4 },
      "main-project": { skewProtectionBoundaryAt: 2 },
    });
  });
});
