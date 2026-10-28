import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
  signInAnonymously: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
}));

// Better Auth's anonymous sign-in needs BotID and a server; the test answers it by hand.
vi.mock("@zoonk/auth/client", () => ({
  authClient: { getSession: auth.getSession, signIn: { anonymous: auth.signInAnonymously } },
}));

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

async function loadHelper() {
  vi.resetModules();
  const { ensureGuestSession } = await import("./ensure-guest-session");
  return ensureGuestSession;
}

describe("ensureGuestSession", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("makes a guest when the browser holds no session", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: null });
    auth.signInAnonymously.mockResolvedValue({ data: { user: { id: "guest-1" } }, error: null });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(true);

    expect(auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it("says no when the guest can't be made", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: null });
    auth.signInAnonymously.mockResolvedValue({ data: null, error: { status: 429 } });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(false);
  });

  it("changes nothing for a session the browser already holds", async () => {
    auth.getSession.mockResolvedValue({ data: { user: { id: "learner-l" } }, error: null });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(true);

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("makes no guest when the session check failed", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: { status: 429 } });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(false);

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
});
