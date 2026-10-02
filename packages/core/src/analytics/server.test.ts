import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackServerEvent, trackSystemEvent } from "./server";
import { buildSharedEventProperties } from "./shared-properties";

// PostHog is an external service; the mock records what would leave the server.
const posthogClient = vi.hoisted(() => ({ capture: vi.fn(), shutdown: vi.fn() }));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(
    class {
      capture = posthogClient.capture;
      shutdown = posthogClient.shutdown;
    },
  ),
}));

const shared = buildSharedEventProperties({ isGuest: false, locale: "pt", platform: "web" });

describe(trackServerEvent, () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "project-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the event with the shared properties and flushes before returning", async () => {
    await trackServerEvent({
      distinctId: "user-id",
      name: "Sign Up Completed",
      properties: { from_guest: false },
      shared,
    });

    expect(PostHog).toHaveBeenCalledExactlyOnceWith("project-token", {
      fetchRetryCount: 1,
      fetchRetryDelay: 500,
      flushAt: 1,
      flushInterval: 0,
      host: "https://posthog.test",
      requestTimeout: 2000,
    });

    expect(posthogClient.capture).toHaveBeenCalledExactlyOnceWith({
      distinctId: "user-id",
      event: "Sign Up Completed",
      properties: {
        from_guest: false,
        goal_kind: null,
        is_guest: false,
        locale: "pt",
        mode: "focus",
        plan_phase: null,
        platform: "web",
      },
    });

    expect(posthogClient.shutdown).toHaveBeenCalledExactlyOnceWith(5000);
  });

  it("sends nothing when PostHog isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");

    await trackServerEvent({ distinctId: "user-id", name: "Sign In Completed", shared });

    expect(PostHog).not.toHaveBeenCalled();
  });

  it("never fails the caller and still closes the client when PostHog throws", async () => {
    posthogClient.capture.mockImplementationOnce(() => {
      throw new Error("PostHog is down");
    });

    await expect(
      trackServerEvent({ distinctId: "user-id", name: "Sign In Completed", shared }),
    ).resolves.toBeUndefined();

    expect(posthogClient.shutdown).toHaveBeenCalledOnce();
  });
});

describe(trackSystemEvent, () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "project-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends work no learner started under the system's id, without a person profile", async () => {
    await trackSystemEvent({
      name: "Generation Failed",
      properties: { content_kind: "lesson", model: null, task: "lesson-content" },
    });

    expect(posthogClient.capture).toHaveBeenCalledExactlyOnceWith({
      distinctId: "zoonk-system",
      event: "Generation Failed",
      properties: {
        $process_person_profile: false,
        content_kind: "lesson",
        model: null,
        task: "lesson-content",
      },
    });

    expect(posthogClient.shutdown).toHaveBeenCalledExactlyOnceWith(5000);
  });
});
