import { getVercelOidcToken } from "@vercel/oidc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiDeploymentHeaders } from "./api-deployment";

/** Vercel Function credentials are an external provider boundary unavailable in local tests. */
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: vi.fn() }));

describe("API deployment authentication", () => {
  beforeEach(() => {
    vi.mocked(getVercelOidcToken).mockResolvedValue("provider-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["production", "development", ""])(
    "omits platform credentials in %s",
    async (environment) => {
      vi.stubEnv("VERCEL_ENV", environment);
      await expect(getApiDeploymentHeaders()).resolves.toStrictEqual({});
      expect(getVercelOidcToken).not.toHaveBeenCalled();
    },
  );

  it.each(["preview", "staging"])("authenticates the %s target", async (target) => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_TARGET_ENV", target);

    await expect(getApiDeploymentHeaders()).resolves.toStrictEqual({
      "x-vercel-trusted-oidc-idp-token": "provider-token",
    });
  });

  it("fails closed when the provider does not supply a token", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.mocked(getVercelOidcToken).mockResolvedValue("");
    await expect(getApiDeploymentHeaders()).rejects.toThrow("Missing Vercel OIDC token");
  });
});
