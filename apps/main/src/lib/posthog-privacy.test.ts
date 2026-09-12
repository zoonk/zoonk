// @vitest-environment jsdom

import posthog from "posthog-js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureRouterTransitionStart: vi.fn(), init: vi.fn() }));

describe("Main PostHog transport privacy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("blocks private SDK traffic and initial attribution while public events still send", async () => {
    const requests: { data?: unknown; url: string }[] = [];
    vi.spyOn(posthog, "_send_request").mockImplementation((request) => requests.push(request));
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://analytics.example.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "privacy-test-token");
    globalThis.history.replaceState(null, "", "/b/me/c/private-family-archive");

    /** Import after the SDK transport is intercepted: the actual app setup must never send real requests. */
    await import("../instrumentation-client");
    posthog.featureFlags.reloadFeatureFlags();
    posthog.capture("Private learning action", {}, { send_instantly: true });

    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 100);
    });

    expect(requests).toStrictEqual([]);

    globalThis.history.replaceState(null, "", "/b/ai/c/physics");
    posthog.capture("Public lesson completed", {}, { send_instantly: true });

    expect(
      requests.some((request) => JSON.stringify(request.data).includes("Public lesson completed")),
    ).toBe(true);

    expect(JSON.stringify(requests)).not.toContain("private-family-archive");
  });
});
