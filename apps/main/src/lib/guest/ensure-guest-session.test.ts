import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
  signInAnonymously: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
}));

const api = vi.hoisted(() => ({ sendFromBrowser: vi.fn<() => Promise<Response | null>>() }));

const age = vi.hoisted(() => ({
  checkBirthYearAction: vi.fn<
    () => Promise<{ minimumAge: number; status: "belowMinimumAge" } | { status: "allowed" }>
  >(async () => ({ status: "allowed" })),
}));

// Better Auth's anonymous sign-in needs BotID and a server; the test answers it by hand.
vi.mock("@zoonk/auth/client", () => ({
  authClient: { getSession: auth.getSession, signIn: { anonymous: auth.signInAnonymously } },
}));

vi.mock("@/lib/api/browser-api", () => api);
vi.mock("@/lib/age/check-birth-year-action", () => age);
vi.mock("@/lib/learner/learner-store", () => ({ ensureLearnerSummary: vi.fn() }));
vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

const NO_SESSION = { data: null, error: null };
const GUEST = { data: { user: { id: "guest-1" } }, error: null };

async function loadHelpers() {
  vi.resetModules();

  const [{ ensureGuestSession }, request] = await Promise.all([
    import("./ensure-guest-session"),
    import("@/lib/age/birth-year-request"),
  ]);

  return { ensureGuestSession, ...request };
}

/** Answers the dialog the way a learner would. */
async function answer(
  helpers: Awaited<ReturnType<typeof loadHelpers>>,
  birthYear: number,
): Promise<unknown> {
  await vi.waitFor(() => expect(helpers.getBirthYearRequest().status).toBe("asking"));
  const request = helpers.getBirthYearRequest();

  if (request.status !== "asking") {
    throw new Error("The dialog isn't asking");
  }

  return helpers.submitBirthYear({ birthYear, signedIn: request.signedIn, submit: request.submit });
}

describe("ensureGuestSession", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("asks the birth year, then makes a guest and saves it", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue(GUEST);
    api.sendFromBrowser.mockResolvedValue(new Response(null, { status: 200 }));
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    await answer(helpers, 1990);

    await expect(guest).resolves.toBe("ready");
    expect(auth.signInAnonymously).toHaveBeenCalledOnce();

    expect(api.sendFromBrowser).toHaveBeenCalledExactlyOnceWith({
      body: { birthYear: 1990 },
      method: "PUT",
      path: "/v1/me/birth-year",
    });

    expect(helpers.getBirthYearRequest().status).toBe("closed");
  });

  it("keeps asking when the guest can't be made, and makes one guest on the next try", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValueOnce({ data: null, error: { status: 429 } });
    api.sendFromBrowser.mockResolvedValue(new Response(null, { status: 200 }));
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();

    await expect(answer(helpers, 1990)).resolves.toStrictEqual({ status: "failed" });
    expect(helpers.getBirthYearRequest().status).toBe("asking");

    auth.signInAnonymously.mockResolvedValueOnce(GUEST);
    await answer(helpers, 1990);

    await expect(guest).resolves.toBe("ready");
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it("says when the bot check refused this browser, since trying again can't help", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);

    auth.signInAnonymously.mockResolvedValue({
      data: null,
      error: { code: "VERIFICATION_FAILED", message: "Captcha verification failed", status: 403 },
    });

    const helpers = await loadHelpers();
    const guest = helpers.ensureGuestSession();
    await answer(helpers, 1990);

    await expect(guest).resolves.toBe("blocked");
  });

  it("stops below the minimum age before any account exists, and for a day after", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    age.checkBirthYearAction.mockResolvedValueOnce({ minimumAge: 14, status: "belowMinimumAge" });
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();
    await answer(helpers, 2015);

    expect(helpers.getBirthYearRequest()).toStrictEqual({
      minimumAge: 14,
      signedIn: false,
      status: "stopped",
    });

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(api.sendFromBrowser).not.toHaveBeenCalled();
    expect(document.cookie).toContain("ZOONK_AGE_STOP=14");
    expect(document.cookie).toContain("max-age=86400");

    helpers.cancelBirthYear();
    await expect(guest).resolves.toBe("cancelled");

    const again = await loadHelpers();
    const retry = again.ensureGuestSession();

    await vi.waitFor(() =>
      expect(again.getBirthYearRequest()).toMatchObject({ minimumAge: 14, status: "stopped" }),
    );

    again.cancelBirthYear();
    await expect(retry).resolves.toBe("cancelled");
    expect(age.checkBirthYearAction).toHaveBeenCalledOnce();
  });

  it("lets a visitor say no to the question, starting nothing", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();
    await vi.waitFor(() => expect(helpers.getBirthYearRequest().status).toBe("asking"));
    helpers.cancelBirthYear();

    await expect(guest).resolves.toBe("cancelled");
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(helpers.getBirthYearRequest().status).toBe("closed");
  });

  it("puts a visitor's usage data choice on the new guest before any learning", async () => {
    vi.stubGlobal("document", { cookie: "ZOONK_USAGE_DATA=off" });
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue(GUEST);
    api.sendFromBrowser.mockResolvedValue(new Response(null, { status: 200 }));
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();
    await answer(helpers, 1990);

    await expect(guest).resolves.toBe("ready");

    expect(api.sendFromBrowser).toHaveBeenLastCalledWith({
      body: { shareUsageData: false },
      method: "PATCH",
      path: "/v1/me/learning-profile",
    });
  });

  it("leaves a visitor's yes off the new guest, who may be a minor who can't give it", async () => {
    vi.stubGlobal("document", { cookie: "ZOONK_USAGE_DATA=on" });
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue(GUEST);
    api.sendFromBrowser.mockResolvedValue(new Response(null, { status: 200 }));
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();
    await answer(helpers, 2011);

    await expect(guest).resolves.toBe("ready");

    expect(api.sendFromBrowser).not.toHaveBeenCalledWith(
      expect.objectContaining({ body: { shareUsageData: true } }),
    );
  });

  it("can't be skipped once the guest exists and its year didn't save", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue(GUEST);
    api.sendFromBrowser.mockResolvedValueOnce(null);
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();

    await expect(answer(helpers, 1990)).resolves.toStrictEqual({
      guestStarted: true,
      status: "failed",
    });

    expect(helpers.getBirthYearRequest()).toMatchObject({ signedIn: true, status: "asking" });
    helpers.cancelBirthYear();
    expect(helpers.getBirthYearRequest().status).toBe("asking");

    auth.getSession.mockResolvedValue(GUEST);
    api.sendFromBrowser.mockResolvedValue(new Response(null, { status: 200 }));
    await answer(helpers, 1990);

    await expect(guest).resolves.toBe("ready");
    expect(auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it("ignores cancelling while the year is on its way", async () => {
    auth.getSession.mockResolvedValue(NO_SESSION);
    auth.signInAnonymously.mockResolvedValue(GUEST);
    api.sendFromBrowser.mockResolvedValue(new Response(null, { status: 200 }));
    const check = Promise.withResolvers<{ status: "allowed" }>();
    age.checkBirthYearAction.mockReturnValueOnce(check.promise);
    const helpers = await loadHelpers();

    const guest = helpers.ensureGuestSession();
    const sent = answer(helpers, 1990);
    await vi.waitFor(() => expect(age.checkBirthYearAction).toHaveBeenCalledOnce());

    helpers.cancelBirthYear();
    expect(helpers.getBirthYearRequest().status).toBe("asking");

    check.resolve({ status: "allowed" });
    await sent;

    await expect(guest).resolves.toBe("ready");
  });

  it("changes nothing for a session the browser already holds", async () => {
    auth.getSession.mockResolvedValue({ data: { user: { id: "learner-l" } }, error: null });
    const helpers = await loadHelpers();

    await expect(helpers.ensureGuestSession()).resolves.toBe("ready");

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(helpers.getBirthYearRequest().status).toBe("closed");
  });

  it("makes no guest when the session check failed", async () => {
    auth.getSession.mockResolvedValue({ data: null, error: { status: 429 } });
    const helpers = await loadHelpers();

    await expect(helpers.ensureGuestSession()).resolves.toBe("failed");

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
});
