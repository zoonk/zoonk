import { afterEach, describe, expect, it, vi } from "vitest";

type SessionRead = { data: { session: { token: string } } | null; error: unknown };

const auth = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<SessionRead>>(),
  sessionChanged: () => {},
}));

// Better Auth's client needs its server to read a session. Like its store, the fake calls a new
// listener at once.
vi.mock("@zoonk/auth/client", () => ({
  authClient: {
    $store: {
      listen: (_signal: string, listener: () => void) => {
        auth.sessionChanged = listener;
        listener();
      },
    },
    getSession: auth.getSession,
  },
}));

function session(token: string): SessionRead {
  return { data: { session: { token } }, error: null };
}

async function loadHelper() {
  vi.resetModules();
  const { getWorkflowAuthHeaders } = await import("./auth-headers");
  return getWorkflowAuthHeaders;
}

describe("getWorkflowAuthHeaders", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads the session once for all of a page's calls, so polling can't use up the session read limit", async () => {
    auth.getSession.mockResolvedValue(session("token-1"));
    const getHeaders = await loadHelper();

    const headers = [...(await Promise.all([getHeaders(), getHeaders()])), await getHeaders()];

    expect(headers).toStrictEqual([
      { Authorization: "Bearer token-1" },
      { Authorization: "Bearer token-1" },
      { Authorization: "Bearer token-1" },
    ]);

    expect(auth.getSession).toHaveBeenCalledOnce();
  });

  it("asks again after a read that was refused, failed or found no session", async () => {
    auth.getSession
      .mockResolvedValueOnce({ data: null, error: { status: 429 } })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue(session("token-1"));

    const getHeaders = await loadHelper();

    await expect(getHeaders()).resolves.toStrictEqual({});
    await expect(getHeaders()).rejects.toThrow("Failed to fetch");
    await expect(getHeaders()).resolves.toStrictEqual({});
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer token-1" });
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer token-1" });

    expect(auth.getSession).toHaveBeenCalledTimes(4);
  });

  it("reads the new session after a sign-in or sign-out in this tab", async () => {
    auth.getSession.mockResolvedValueOnce(session("lost")).mockResolvedValue(session("guest"));
    const getHeaders = await loadHelper();

    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer lost" });
    auth.sessionChanged();
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer guest" });
  });
});
