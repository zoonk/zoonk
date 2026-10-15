import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Every step of making a guest, in the order it ran. */
const steps: string[] = [];

/** Whether the browser still holds the guest's tag when the store hears of it. */
const browser = { holdsGuest: true };

const auth = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
  signInAnonymously:
    vi.fn<
      (input: {
        fetchOptions: { onResponse: (context: { response: Response }) => void };
      }) => Promise<{ data: unknown; error: unknown }>
    >(),
}));

// Better Auth's anonymous sign-in needs BotID and a server; the test answers it by hand.
vi.mock("@zoonk/auth/client", () => ({
  authClient: { getSession: auth.getSession, signIn: { anonymous: auth.signInAnonymously } },
}));

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

// The store's other exports stay real: it connects to the summary store as it loads.
vi.mock("@/lib/learner/learner-identity", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  beginLocalAuthChange: vi.fn(() => {
    steps.push("begin");

    return {
      complete: ({ actor, tag }: { actor: string | null; tag: string | null }) => {
        steps.push(`complete ${actor} ${tag}`);
        return browser.holdsGuest;
      },
      release: () => steps.push("release"),
    };
  }),
}));

/** A fresh helper: the guest it may be making lives in its module. */
async function loadHelper() {
  vi.resetModules();
  const { ensureGuestSession } = await import("./ensure-guest-session");
  return ensureGuestSession;
}

describe("ensureGuestSession", () => {
  beforeEach(() => {
    steps.length = 0;
    browser.holdsGuest = true;

    auth.signInAnonymously.mockImplementation(async ({ fetchOptions }) => {
      steps.push("sign in");

      fetchOptions.onResponse({
        response: new Response(null, { headers: { "x-zoonk-session-hint": "t1.guest" } }),
      });

      return { data: { user: { id: "guest-1" } }, error: null };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("begins its own change before signing in and goes on as the guest its answer named", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: null });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(true);

    expect(steps).toStrictEqual(["begin", "sign in", "complete guest-1 t1.guest", "release"]);
  });

  it("doesn't go on as the guest when another tab took the session meanwhile", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: null });
    browser.holdsGuest = false;
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(false);

    expect(steps).toStrictEqual(["begin", "sign in", "complete guest-1 t1.guest", "release"]);
  });

  it("ends its change without completing it when the guest can't be made", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: null });

    auth.signInAnonymously.mockImplementation(async () => {
      steps.push("sign in");
      return { data: null, error: { status: 429 } };
    });

    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(false);

    expect(steps).toStrictEqual(["begin", "sign in", "release"]);
  });

  it("changes nothing for a session the browser already holds", async () => {
    auth.getSession.mockResolvedValue({ data: { user: { id: "learner-l" } }, error: null });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(true);

    expect(steps).toStrictEqual([]);
  });

  it("makes no guest when the session check failed", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: { status: 429 } });
    const ensureGuestSession = await loadHelper();

    await expect(ensureGuestSession()).resolves.toBe(false);

    expect(steps).toStrictEqual([]);
  });
});
