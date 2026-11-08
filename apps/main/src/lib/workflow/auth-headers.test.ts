import { afterEach, describe, expect, it, vi } from "vitest";

type SessionRead = { data: { session: { token: string } } | null; error: unknown };

const auth = vi.hoisted(() => ({ getSession: vi.fn<() => Promise<SessionRead>>() }));

// Better Auth's client needs its server to read a session.
vi.mock("@zoonk/auth/client", () => ({ authClient: { getSession: auth.getSession } }));

function session(token: string): SessionRead {
  return { data: { session: { token } }, error: null };
}

async function loadHelpers() {
  vi.resetModules();
  return import("./auth-headers");
}

describe("getWorkflowAuthHeaders", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads the session once for all of a page's calls, so polling can't use up the session read limit", async () => {
    auth.getSession.mockResolvedValue(session("token-1"));
    const { getWorkflowAuthHeaders: getHeaders } = await loadHelpers();

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

    const { getWorkflowAuthHeaders: getHeaders } = await loadHelpers();

    await expect(getHeaders()).resolves.toStrictEqual({});
    await expect(getHeaders()).rejects.toThrow("Failed to fetch");
    await expect(getHeaders()).resolves.toStrictEqual({});
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer token-1" });
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer token-1" });

    expect(auth.getSession).toHaveBeenCalledTimes(4);
  });

  it("shares a read in flight, so a guest's first write can't reuse an answer from before the guest", async () => {
    const firstRead = Promise.withResolvers<SessionRead>();
    auth.getSession.mockReturnValueOnce(firstRead.promise).mockResolvedValue(session("guest"));
    const { getWorkflowAuthHeaders: getHeaders, readBrowserSession } = await loadHelpers();

    const pollHeaders = getHeaders();
    const guestCheck = readBrowserSession();
    await vi.waitFor(() => expect(auth.getSession).toHaveBeenCalledOnce());
    firstRead.resolve({ data: null, error: null });

    await expect(guestCheck).resolves.toStrictEqual({ data: null, error: null });
    await expect(pollHeaders).resolves.toStrictEqual({});
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer guest" });

    expect(auth.getSession).toHaveBeenCalledTimes(2);
  });

  it("sends the session the page read last, such as a guest's made after the old one ended", async () => {
    auth.getSession
      .mockResolvedValueOnce(session("ended"))
      .mockResolvedValueOnce({ data: null, error: { status: 429 } })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce(session("guest"))
      .mockResolvedValueOnce(session("guest-2"));

    const { getWorkflowAuthHeaders: getHeaders, readBrowserSession } = await loadHelpers();

    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer ended" });
    await readBrowserSession();
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer ended" });
    await readBrowserSession();
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer guest" });
    await readBrowserSession();
    await expect(getHeaders()).resolves.toStrictEqual({ Authorization: "Bearer guest-2" });

    expect(auth.getSession).toHaveBeenCalledTimes(5);
  });
});
