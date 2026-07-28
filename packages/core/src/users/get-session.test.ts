import { auth } from "@zoonk/auth";
import { cacheTag } from "next/cache";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserSessionCacheTag } from "../cache/tags";
import { getSession } from "./get-session";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn<(input: unknown) => Promise<unknown>>() }));

vi.mock("@zoonk/auth", () => ({ auth: { api: { getSession: authMocks.getSession } } }));

vi.mock("next/headers", () => ({ headers: vi.fn() }));

describe(getSession, () => {
  beforeEach(() => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    authMocks.getSession.mockResolvedValue(null);
  });

  it("passes the current request headers to Better Auth", async () => {
    const requestHeaders = new Headers({ authorization: "Bearer token" });
    const session = { user: { id: "user-id" } };
    vi.mocked(headers).mockResolvedValue(requestHeaders);
    authMocks.getSession.mockResolvedValue(session);

    await expect(getSession()).resolves.toBe(session);

    expect(auth.api.getSession).toHaveBeenCalledExactlyOnceWith({ headers: requestHeaders });
    expect(cacheTag).toHaveBeenCalledExactlyOnceWith(getUserSessionCacheTag("user-id"));
  });

  it("does not tag an unauthenticated request", async () => {
    await expect(getSession()).resolves.toBeNull();
    expect(cacheTag).not.toHaveBeenCalled();
  });
});
