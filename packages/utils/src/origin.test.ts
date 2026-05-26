import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllowedHosts, getBaseUrl, isCorsAllowedOrigin } from "./origin";

describe(getBaseUrl, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns https URL when NEXT_PUBLIC_APP_DOMAIN is set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "api.zoonk.com");
    expect(getBaseUrl()).toBe("https://api.zoonk.com");
  });

  it("returns http URL for localhost domains", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "localhost:4000");
    expect(getBaseUrl()).toBe("http://localhost:4000");
  });

  it("prioritizes NEXT_PUBLIC_APP_DOMAIN over VERCEL_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "api.zoonk.dev");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "zoonk-abc123.vercel.app");
    expect(getBaseUrl()).toBe("https://api.zoonk.dev");
  });

  it("falls back to VERCEL_URL in preview when NEXT_PUBLIC_APP_DOMAIN is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "zoonk-abc123.vercel.app");
    expect(getBaseUrl()).toBe("https://zoonk-abc123.vercel.app");
  });

  it("throws when neither NEXT_PUBLIC_APP_DOMAIN nor VERCEL_URL is available", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(() => getBaseUrl()).toThrow("NEXT_PUBLIC_APP_DOMAIN environment variable is not set");
  });
});

describe(getAllowedHosts, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("always includes all zoonk hosts", () => {
    const hosts = getAllowedHosts();
    expect(hosts).toContain("zoonk.com");
    expect(hosts).toContain("*.zoonk.com");
    expect(hosts).toContain("zoonk.dev");
    expect(hosts).toContain("*.zoonk.dev");
  });

  it("includes localhost:* in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getAllowedHosts()).toContain("localhost:*");
  });

  it("includes localhost:* in production with E2E_TESTING=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TESTING", "true");
    expect(getAllowedHosts()).toContain("localhost:*");
  });

  it("excludes localhost:* in production (non-e2e)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
    expect(getAllowedHosts()).not.toContain("localhost:*");
  });

  it("includes *-zoonk.vercel.app when not Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(getAllowedHosts()).toContain("*-zoonk.vercel.app");
  });

  it("excludes *-zoonk.vercel.app in Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getAllowedHosts()).not.toContain("*-zoonk.vercel.app");
  });
});

describe(isCorsAllowedOrigin, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("zoonk domains", () => {
    it("allows https://zoonk.com", () => {
      expect(isCorsAllowedOrigin("https://zoonk.com")).toBe(true);
    });

    it("allows subdomains of zoonk.com", () => {
      expect(isCorsAllowedOrigin("https://api.zoonk.com")).toBe(true);
      expect(isCorsAllowedOrigin("https://www.zoonk.com")).toBe(true);
      expect(isCorsAllowedOrigin("https://app.zoonk.com")).toBe(true);
    });

    it("allows zoonk.dev and subdomains", () => {
      expect(isCorsAllowedOrigin("https://zoonk.dev")).toBe(true);
      expect(isCorsAllowedOrigin("https://api.zoonk.dev")).toBe(true);
    });

    it("rejects non-zoonk domains", () => {
      expect(isCorsAllowedOrigin("https://evil.com")).toBe(false);
      expect(isCorsAllowedOrigin("https://notzoonk.com")).toBe(false);
      expect(isCorsAllowedOrigin("https://zoonk.com.evil.com")).toBe(false);
    });

    it("rejects http for zoonk domains", () => {
      expect(isCorsAllowedOrigin("http://zoonk.com")).toBe(false);
      expect(isCorsAllowedOrigin("http://api.zoonk.com")).toBe(false);
    });
  });

  describe("localhost", () => {
    it("allows valid localhost ports in dev", () => {
      expect(isCorsAllowedOrigin("http://localhost:3000")).toBe(true);
      expect(isCorsAllowedOrigin("http://localhost:4000")).toBe(true);
      expect(isCorsAllowedOrigin("http://localhost:8080")).toBe(true);
      expect(isCorsAllowedOrigin("http://localhost:65535")).toBe(true);
    });

    it("rejects https localhost", () => {
      expect(isCorsAllowedOrigin("https://localhost:3000")).toBe(false);
    });

    it("rejects localhost without port", () => {
      expect(isCorsAllowedOrigin("http://localhost")).toBe(false);
    });

    it("rejects invalid port values", () => {
      expect(isCorsAllowedOrigin("http://localhost:")).toBe(false);
      expect(isCorsAllowedOrigin("http://localhost:abc")).toBe(false);
      expect(isCorsAllowedOrigin("http://localhost:3000/path")).toBe(false);
      expect(isCorsAllowedOrigin("http://localhost:3000@evil.com")).toBe(false);
    });

    it("rejects localhost in production (non-e2e)", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("E2E_TESTING", "false");
      expect(isCorsAllowedOrigin("http://localhost:3000")).toBe(false);
    });

    it("allows localhost in production when E2E_TESTING is true", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("E2E_TESTING", "true");
      expect(isCorsAllowedOrigin("http://localhost:3000")).toBe(true);
    });
  });

  describe("vercel previews", () => {
    it("allows vercel preview deployments when not in production", () => {
      expect(isCorsAllowedOrigin("https://my-branch-zoonk.vercel.app")).toBe(true);
      expect(isCorsAllowedOrigin("https://feature-123-zoonk.vercel.app")).toBe(true);
    });

    it("rejects vercel apps that don't end with -zoonk", () => {
      expect(isCorsAllowedOrigin("https://other-project.vercel.app")).toBe(false);
      expect(isCorsAllowedOrigin("https://zoonk.vercel.app")).toBe(false);
    });

    it("rejects http vercel preview deployments", () => {
      expect(isCorsAllowedOrigin("http://my-branch-zoonk.vercel.app")).toBe(false);
    });

    it("rejects vercel preview deployments in production", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      expect(isCorsAllowedOrigin("https://my-branch-zoonk.vercel.app")).toBe(false);
    });
  });

  describe("rejected origins", () => {
    it("rejects random external domains", () => {
      expect(isCorsAllowedOrigin("https://google.com")).toBe(false);
      expect(isCorsAllowedOrigin("https://evil-site.com")).toBe(false);
    });

    it("rejects domains that look similar but are not zoonk", () => {
      expect(isCorsAllowedOrigin("https://fakezoonk.com")).toBe(false);
      expect(isCorsAllowedOrigin("https://zoonk-fake.com")).toBe(false);
    });
  });
});
