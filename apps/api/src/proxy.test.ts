import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const previewOrigin = "https://zoonk-git-cw-restore-explore-courses-link-zoonk.vercel.app";

describe(proxy, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows staging API preflight requests from Zoonk preview deployments", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "api.zoonk.dev");
    vi.stubEnv("VERCEL_ENV", "production");

    const response = proxy(
      new NextRequest("https://api.zoonk.dev/v1/workflows/course-generation/trigger", {
        headers: { origin: previewOrigin },
        method: "OPTIONS",
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
  });

  it("keeps production API preflight requests closed to Zoonk preview deployments", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "api.zoonk.com");
    vi.stubEnv("VERCEL_ENV", "production");

    const response = proxy(
      new NextRequest("https://api.zoonk.com/v1/workflows/course-generation/trigger", {
        headers: { origin: previewOrigin },
        method: "OPTIONS",
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
