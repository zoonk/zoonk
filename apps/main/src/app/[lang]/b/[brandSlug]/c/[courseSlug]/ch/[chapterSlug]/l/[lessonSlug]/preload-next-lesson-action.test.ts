import { API_URL } from "@zoonk/utils/url";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadNextLesson } from "./preload-next-lesson-action";

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => Promise<void>) => void>(),
  fetch: vi.fn(),
  getSession: vi.fn(),
}));

// Core/API session authorization has integration coverage. This delivery test
// captures the external HTTP credential choice and the platform after callback.
vi.mock("@zoonk/core/users/session", () => ({ getSession: mocks.getSession }));
vi.mock("next/server", () => ({ after: mocks.after }));

const lessonId = "10000000-0000-4000-8000-000000000001";
const inertToken = "inert-preload-transport-test-token";

describe(preloadNextLesson, () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(null);
    mocks.fetch.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", mocks.fetch);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ cookie: "better-auth.session_token=inert-cookie; ZOONK_LOCALE=en" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the trusted bearer session without forwarding browser cookies or origin", async () => {
    mocks.getSession.mockResolvedValue({ session: { token: inertToken } });

    await preloadNextLesson(lessonId);
    expect(mocks.fetch).not.toHaveBeenCalled();

    const callback = mocks.after.mock.calls.at(0)?.[0];
    expect(callback).toBeDefined();
    await callback?.();

    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(
      `${API_URL}/v1/lessons/${lessonId}/preloads`,
      { headers: { Authorization: `Bearer ${inertToken}` }, method: "POST" },
    );
  });

  it("does not schedule an unauthenticated background API request", async () => {
    await preloadNextLesson(lessonId);

    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
