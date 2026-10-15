import { afterEach, describe, expect, it, vi } from "vitest";

// PostHog's SDK failing to load or start can't be produced with the real one in a test.
vi.mock("./posthog", () => ({ resetPostHogUser: vi.fn(async () => {}) }));

/**
 * A browser tab whose cookie writes fail or not, with what it tells the other tabs and the errors
 * it reports.
 */
function stubTab({ cookieWriteFails }: { cookieWriteFails: boolean }) {
  const announced: unknown[] = [];
  const reported: unknown[] = [];

  vi.stubGlobal("document", { addEventListener: vi.fn(), cookie: "zoonk-signed-in=1" });
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("reportError", (error: unknown) => reported.push(error));

  vi.stubGlobal("cookieStore", {
    set: vi.fn(async () => {
      if (cookieWriteFails) {
        throw new Error("cookie not written");
      }
    }),
  });

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

  const [{ endLearnerSession }, { resetPostHogUser }] = await Promise.all([
    import("./end-learner-session"),
    import("./posthog"),
  ]);

  return { endLearnerSession, resetPostHogUser: vi.mocked(resetPostHogUser) };
}

describe("endLearnerSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ends the session and tells the other tabs when forgetting the learner here fails", async () => {
    const tab = stubTab({ cookieWriteFails: true });
    const { endLearnerSession, resetPostHogUser } = await loadHelper();
    const analyticsFailure = new Error("PostHog didn't load");
    resetPostHogUser.mockRejectedValueOnce(analyticsFailure);
    const endSession = vi.fn(async () => {});

    await endLearnerSession(endSession);

    expect(endSession).toHaveBeenCalledOnce();
    expect(tab.announced).toStrictEqual([{ identity: null }]);
    expect(tab.reported).toStrictEqual([analyticsFailure, new Error("cookie not written")]);
  });

  it("tells the other tabs when ending the session fails", async () => {
    const tab = stubTab({ cookieWriteFails: false });
    const { endLearnerSession } = await loadHelper();
    const signOutFailure = new Error("sign-out failed");

    await expect(
      endLearnerSession(async () => {
        throw signOutFailure;
      }),
    ).rejects.toBe(signOutFailure);

    expect(tab.announced).toStrictEqual([{ identity: null }]);
    expect(tab.reported).toStrictEqual([]);
  });
});
