import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnvironment } from "./environment";

describe(getEnvironment, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    {
      NODE_ENV: "development",
      VERCEL_ENV: "",
      ZOONK_LOCAL_PRODUCTION: "",
      expected: "development",
    },
    // `pnpm start` marks the production builds it serves on this machine.
    {
      NODE_ENV: "production",
      VERCEL_ENV: "",
      ZOONK_LOCAL_PRODUCTION: "true",
      expected: "development",
    },
    // A deployment missing Vercel's variables fails closed.
    { NODE_ENV: "production", VERCEL_ENV: "", ZOONK_LOCAL_PRODUCTION: "", expected: "preview" },
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      ZOONK_LOCAL_PRODUCTION: "true",
      expected: "preview",
    },
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      ZOONK_LOCAL_PRODUCTION: "true",
      expected: "production",
    },
  ])(
    "is $expected with NODE_ENV=$NODE_ENV, VERCEL_ENV=$VERCEL_ENV and ZOONK_LOCAL_PRODUCTION=$ZOONK_LOCAL_PRODUCTION",
    ({ expected, ...environment }) => {
      vi.stubEnv("E2E_TESTING", "");
      Object.entries(environment).forEach(([name, value]) => vi.stubEnv(name, value));
      expect(getEnvironment()).toBe(expected);
    },
  );

  it("is e2e for E2E servers, which run production builds outside Vercel", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("E2E_TESTING", "true");
    expect(getEnvironment()).toBe("e2e");
  });
});
