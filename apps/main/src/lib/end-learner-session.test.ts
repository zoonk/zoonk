import { afterEach, describe, expect, it, vi } from "vitest";

// One function in every fresh module: each test drives the one the helper calls.
const analytics = vi.hoisted(() => ({ resetPostHogUser: vi.fn(async () => {}) }));

// PostHog's SDK failing to load or start can't be produced with the real one in a test.
vi.mock("./posthog", () => analytics);

/** A browser tab, with what it tells the other tabs and the errors it reports. */
function stubTab() {
  const announced: unknown[] = [];
  const reported: unknown[] = [];

  vi.stubGlobal("document", { addEventListener: vi.fn(), cookie: "zoonk-signed-in=1" });
  vi.stubGlobal("addEventListener", vi.fn());
  vi.stubGlobal("reportError", (error: unknown) => reported.push(error));

  vi.stubGlobal(
    "BroadcastChannel",
    class {
      addEventListener = vi.fn();
      postMessage = vi.fn((data: unknown) => announced.push(data));
    },
  );

  return { announced, reported };
}

/** A fresh helper: the learner store it tells lives in its module, once per page. */
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
    expect(tab.announced).toStrictEqual([{ check: true }]);
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

    expect(tab.announced).toStrictEqual([{ check: true }]);
    expect(tab.reported).toStrictEqual([]);
  });
});
