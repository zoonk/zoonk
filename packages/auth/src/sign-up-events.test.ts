import { describe, expect, it, vi } from "vitest";
import {
  createTestEmail,
  signInAsGuest,
  signInWithPassword,
  signUp,
} from "./guests/_test-utils/guest-auth";
import { registerSignUpSink } from "./sign-up-events";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

describe("sign-up events", () => {
  it("reports an account once, as it's created, and never a guest", async () => {
    const sink = vi.fn(() => Promise.resolve());
    registerSignUpSink(sink);

    const { headers } = await signInAsGuest();
    expect(sink).not.toHaveBeenCalled();

    const email = createTestEmail();
    const { userId } = await signUp({ email, headers });
    await signInWithPassword({ email, headers: new Headers() });

    expect(sink).toHaveBeenCalledExactlyOnceWith({ userId });
  });

  it("never fails a sign-up when analytics does", async () => {
    registerSignUpSink(vi.fn().mockRejectedValue(new Error("PostHog is down")));

    await expect(signUp({ email: createTestEmail() })).resolves.toMatchObject({
      userId: expect.any(String),
    });
  });
});
