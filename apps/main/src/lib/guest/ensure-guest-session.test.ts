import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
  signInAnonymously: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
}));

const api = vi.hoisted(() => ({ sendFromBrowser: vi.fn<() => Promise<Response | null>>() }));

// Better Auth's anonymous sign-in needs BotID and a server; the test answers it by hand.
vi.mock("@zoonk/auth/client", () => ({
  authClient: { getSession: auth.getSession, signIn: { anonymous: auth.signInAnonymously } },
}));

vi.mock("@/lib/api/browser-api", () => api);
vi.mock("@/lib/learner/learner-store", () => ({ ensureLearnerSummary: vi.fn() }));
vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

const NO_SESSION = { data: null, error: null };
const GUEST = { data: { user: { id: "guest-1" } }, error: null };

async function loadHelper() {
  vi.resetModules();
  const { ensureGuestSession } = await import("./ensure-guest-session");
  return ensureGuestSession;
}

describe("ensureGuestSession", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("makes a guest when the browser holds no session", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue(GUEST);
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe("ready");

    expect(auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(api.sendFromBrowser).not.toHaveBeenCalled();
  });

  it("says no when the guest can't be made", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue({ data: null, error: { status: 429 } });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe("failed");
  });

  it("says when the bot check refused this browser, since trying again can't help", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);

    auth.signInAnonymously.mockResolvedValue({
      data: null,
      error: { code: "VERIFICATION_FAILED", message: "Captcha verification failed", status: 403 },
    });

    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe("blocked");
  });

  it.each([
    ["off", false],
    ["on", true],
  ])(
    "puts a visitor's usage data choice (%s) on the new guest before any learning",
    async (cookie, share) => {
      vi.stubGlobal("document", { cookie: `ZOONK_USAGE_DATA=${cookie}` });
      auth.getSession.mockResolvedValue(NO_SESSION);
      auth.signInAnonymously.mockResolvedValue(GUEST);
      api.sendFromBrowser.mockResolvedValue(new Response(null, { status: 200 }));
      const ensureGuestSession = await loadHelper();

      await expect(ensureGuestSession()).resolves.toBe("ready");

      expect(api.sendFromBrowser).toHaveBeenCalledExactlyOnceWith({
        body: { shareUsageData: share },
        method: "PATCH",
        path: "/v1/me/learning-profile",
      });
    },
  );

  it("says no when the visitor's choice couldn't reach the new guest", async () => {
    vi.stubGlobal("document", { cookie: "ZOONK_USAGE_DATA=off" });
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue(GUEST);
    api.sendFromBrowser.mockResolvedValue(null);
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe("failed");
  });

  it("changes nothing for a session the browser already holds", async () => {
    auth.getSession.mockResolvedValue({ data: { user: { id: "learner-l" } }, error: null });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe("ready");

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("makes no guest when the session check failed", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: { status: 429 } });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe("failed");

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
});
