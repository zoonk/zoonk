import { API_URL } from "@zoonk/utils/url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserApiUrl } from "./browser-api-url";

describe("browser API routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    { origin: "https://main-preview.vercel.app", target: "preview" },
    { origin: "https://main.zoonk.dev", target: "staging" },
  ])("routes Vercel $target calls through the current Main origin", ({ target, origin }) => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_TARGET_ENV", target);
    vi.stubGlobal("location", { origin });
    expect(getBrowserApiUrl()).toBe(origin);
  });

  it.each(["production", "development", undefined])(
    "keeps direct API calls in %s",
    (environment) => {
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", environment);
      vi.stubGlobal("location", { origin: "https://www.zoonk.com" });
      expect(getBrowserApiUrl()).toBe(API_URL);
    },
  );

  it("keeps the API origin during server rendering", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    expect(getBrowserApiUrl()).toBe(API_URL);
  });
});
