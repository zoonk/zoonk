import { afterEach, describe, expect, it, vi } from "vitest";

const analytics = vi.hoisted(() => ({ resetPostHogUser: vi.fn(async () => {}) }));

// PostHog's SDK failing to load or start can't be produced with the real one in a test.
vi.mock("./posthog", () => analytics);

function stubTab() {
  const announced: unknown[] = [];
  const reported: unknown[] = [];

  vi.stubGlobal("reportError", (error: unknown) => reported.push(error));

  vi.stubGlobal(
    "BroadcastChannel",
    class {
      close = vi.fn();
      postMessage = vi.fn((data: unknown) => announced.push(data));
    },
  );

  return { announced, reported };
}

async function loadHelper() {
  vi.resetModules();

  const { endLearnerSession } = await import("./end-learner-session");

  return { endLearnerSession, resetPostHogUser: analytics.resetPostHogUser };
}

describe("endLearnerSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ends the session and tells the other tabs when forgetting the learner here fails", async () => {
    const tab = stubTab();
    const { endLearnerSession, resetPostHogUser } = await loadHelper();
    const analyticsFailure = new Error("PostHog didn't load");
    resetPostHogUser.mockRejectedValueOnce(analyticsFailure);
    const endSession = vi.fn(async () => {});

    await endLearnerSession(endSession);

    expect(endSession).toHaveBeenCalledOnce();
    expect(tab.announced).toStrictEqual([null]);
    expect(tab.reported).toStrictEqual([analyticsFailure]);
  });

  it("tells the other tabs when ending the session fails", async () => {
    const tab = stubTab();
    const { endLearnerSession } = await loadHelper();
    const signOutFailure = new Error("sign-out failed");

    await expect(
      endLearnerSession(async () => {
        throw signOutFailure;
      }),
    ).rejects.toBe(signOutFailure);

    expect(tab.announced).toStrictEqual([null]);
    expect(tab.reported).toStrictEqual([]);
  });
});
