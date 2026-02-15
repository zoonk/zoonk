import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthBaseUrl, getCrossSubDomainCookies } from "./env";

describe(getAuthBaseUrl, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns VERCEL_URL with https in preview environment", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "my-app-abc123.vercel.app");
    expect(getAuthBaseUrl()).toBe("https://my-app-abc123.vercel.app");
  });

  it("returns BETTER_AUTH_URL when not in preview", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://api.zoonk.com");
    expect(getAuthBaseUrl()).toBe("https://api.zoonk.com");
  });

  it("returns BETTER_AUTH_URL when VERCEL_ENV is not set", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://api.zoonk.com");
    expect(getAuthBaseUrl()).toBe("https://api.zoonk.com");
  });

  it("returns undefined when no env vars are set", () => {
    expect(getAuthBaseUrl()).toBeUndefined();
  });

  it("returns BETTER_AUTH_URL when VERCEL_ENV is preview but VERCEL_URL is missing", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("BETTER_AUTH_URL", "https://api.zoonk.com");
    expect(getAuthBaseUrl()).toBe("https://api.zoonk.com");
  });
});

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
