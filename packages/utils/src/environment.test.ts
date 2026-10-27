import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnvironment } from "./environment";

describe(getEnvironment, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { E2E_TESTING: "", NODE_ENV: "development", VERCEL_ENV: "", expected: "development" },
    // `pnpm start` serves production builds on this machine with Vercel's name for it.
    { E2E_TESTING: "", NODE_ENV: "production", VERCEL_ENV: "development", expected: "development" },
    // A deployment missing Vercel's variables fails closed.
    { E2E_TESTING: "", NODE_ENV: "production", VERCEL_ENV: "", expected: "preview" },
    { E2E_TESTING: "", NODE_ENV: "production", VERCEL_ENV: "preview", expected: "preview" },
    { E2E_TESTING: "", NODE_ENV: "production", VERCEL_ENV: "production", expected: "production" },
    { E2E_TESTING: "true", NODE_ENV: "production", VERCEL_ENV: "", expected: "e2e" },
  ])(
    "is $expected with NODE_ENV=$NODE_ENV, VERCEL_ENV=$VERCEL_ENV and E2E_TESTING=$E2E_TESTING",
    ({ expected, ...environment }) => {
      Object.entries(environment).forEach(([name, value]) => vi.stubEnv(name, value));
      expect(getEnvironment()).toBe(expected);
    },
  );
});
