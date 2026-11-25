import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { limitSkewProtectionToRunningRelease } from "./skew-protection.mts";

const RUNNING_RELEASE: Record<string, { createdAt: number; id: string }> = {
  "admin.zoonk.com": { createdAt: 1_795_463_143_570, id: "admin-running" },
  "api.zoonk.com": { createdAt: 1_795_463_143_192, id: "api-running" },
  "www.zoonk.com": { createdAt: 1_795_463_143_346, id: "main-running" },
};

beforeEach(() => {
  vi.stubEnv("VERCEL_TOKEN", "test-vercel-token");
  vi.stubEnv("VERCEL_ORG_ID", "test-team");
  vi.stubEnv("VERCEL_PROJECT_ID_API", "api-project");
  vi.stubEnv("VERCEL_PROJECT_ID_MAIN", "main-project");
  vi.stubEnv("VERCEL_PROJECT_ID_ADMIN", "admin-project");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe(limitSkewProtectionToRunningRelease, () => {
  it("stops open tabs reaching any deployment older than the one each production domain serves", async () => {
    const boundaries: Record<string, unknown> = {};

    vi.stubGlobal("fetch", (url: URL, init: RequestInit) => {
      const target = url.pathname.split("/").at(-1) ?? "";

      if (init.method === "PATCH") {
        boundaries[target] = z
          .object({ skewProtectionBoundaryAt: z.number() })
          .parse(JSON.parse(typeof init.body === "string" ? init.body : "{}"));

        return Promise.resolve(Response.json({}));
      }

      return Promise.resolve(Response.json(RUNNING_RELEASE[target]));
    });

    await limitSkewProtectionToRunningRelease();

    expect(boundaries).toStrictEqual({
      "admin-project": { skewProtectionBoundaryAt: 1_795_463_143_570 },
      "api-project": { skewProtectionBoundaryAt: 1_795_463_143_192 },
      "main-project": { skewProtectionBoundaryAt: 1_795_463_143_346 },
    });
  });
});
