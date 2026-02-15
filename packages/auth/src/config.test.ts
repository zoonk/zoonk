import { afterEach, describe, expect, it, vi } from "vitest";
import { getCrossSubDomainCookies } from "./env";

describe(getCrossSubDomainCookies, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns cookie config in production with domain set", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BETTER_AUTH_COOKIE_DOMAIN", "zoonk.com");
    expect(getCrossSubDomainCookies()).toEqual({
      domain: "zoonk.com",
      enabled: true,
    });
  });

  it("returns undefined when not in production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("BETTER_AUTH_COOKIE_DOMAIN", "zoonk.com");
    expect(getCrossSubDomainCookies()).toBeUndefined();
  });

  it("returns undefined when domain is not set", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getCrossSubDomainCookies()).toBeUndefined();
  });

  it("returns undefined when no env vars are set", () => {
    expect(getCrossSubDomainCookies()).toBeUndefined();
  });
});
