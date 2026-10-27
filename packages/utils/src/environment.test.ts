import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnvironment } from "./environment";

describe(getEnvironment, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { E2E_TESTING: "", NODE_ENV: "development", VERCEL_ENV: "", expected: "development" },
    // `pnpm start` serves a production build on this machine, outside any Vercel deployment.
    { E2E_TESTING: "", NODE_ENV: "production", VERCEL_ENV: "", expected: "development" },
    { E2E_TESTING: "true", NODE_ENV: "production", VERCEL_ENV: "", expected: "e2e" },
    { E2E_TESTING: "", NODE_ENV: "production", VERCEL_ENV: "preview", expected: "preview" },
    { E2E_TESTING: "", NODE_ENV: "production", VERCEL_ENV: "production", expected: "production" },
  ])(
    "is $expected with NODE_ENV=$NODE_ENV, VERCEL_ENV=$VERCEL_ENV and E2E_TESTING=$E2E_TESTING",
    ({ expected, ...environment }) => {
      Object.entries(environment).forEach(([name, value]) => vi.stubEnv(name, value));
      expect(getEnvironment()).toBe(expected);
    },
  );
});
