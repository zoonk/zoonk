import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("API_URL", () => {
  // `API_URL` is read when the module loads: each test loads it again after stubbing its env,
  // whatever loaded it before in this worker.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the API deployment explicitly supplied to a preview consumer", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "zoonk-main-123-zoonk.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://zoonk-api-123-zoonk.vercel.app");
    const { API_URL } = await import("./url");
    expect(API_URL).toBe("https://zoonk-api-123-zoonk.vercel.app");
  });

  it("uses the API preview's own host when no API URL override is supplied", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "zoonk-api-123-zoonk.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { API_URL } = await import("./url");
    expect(API_URL).toBe("https://zoonk-api-123-zoonk.vercel.app");
  });
});
