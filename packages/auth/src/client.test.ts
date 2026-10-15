import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SignOutResponse = { error: { status: number } | null };

/** Each host's sign-out, answered by the test when it chooses. */
const hosts = vi.hoisted(() => ({
  app: vi.fn<() => Promise<SignOutResponse>>(),
  central: vi.fn<() => Promise<SignOutResponse>>(),
}));

// The app host and central auth are separate servers: the test answers each sign-out by hand.
vi.mock("better-auth/react", () => ({
  createAuthClient: (options: { baseURL?: string }) => ({
    signOut: options.baseURL ? hosts.central : hosts.app,
  }),
}));

const OK: SignOutResponse = { error: null };
const FAILED: SignOutResponse = { error: { status: 500 } };

describe("logout", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "/today" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("says the app's session ended as soon as the app host answers, before central auth does", async () => {
    const central = Promise.withResolvers<SignOutResponse>();
    hosts.app.mockResolvedValue(OK);
    hosts.central.mockReturnValue(central.promise);
    const onAppSignedOut = vi.fn();
    const { logout } = await import("./client");

    const leaving = logout({ onAppSignedOut });
    await vi.waitFor(() => expect(onAppSignedOut).toHaveBeenCalledOnce());

    expect(location.href).toBe("/today");

    central.resolve(OK);
    await leaving;

    expect(location.href).toBe("/");
  });

  it("says nothing when the app host's sign-out failed", async () => {
    hosts.app.mockResolvedValue(FAILED);
    hosts.central.mockResolvedValue(OK);
    const onAppSignedOut = vi.fn();
    const { logout } = await import("./client");

    await logout({ onAppSignedOut });

    expect(onAppSignedOut).not.toHaveBeenCalled();
    expect(location.href).toBe("/today");
  });

  it("says the app's session ended even when central auth's sign-out failed, and stays", async () => {
    hosts.app.mockResolvedValue(OK);
    hosts.central.mockResolvedValue(FAILED);
    const onAppSignedOut = vi.fn();
    const { logout } = await import("./client");

    await logout({ onAppSignedOut });

    expect(onAppSignedOut).toHaveBeenCalledOnce();
    expect(location.href).toBe("/today");
  });
});
