import { type GenericEndpointContext } from "better-auth";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it, vi } from "vitest";
import { registerAuthEventSink } from "./auth-events";
import { reportSignInAfterSessionCreate } from "./db-hooks";
import { AccountDeletionEmailMismatchError } from "./email-deletion-contract";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import { createEmailOTPPlugin } from "./email-otp-plugin";
import {
  createTestEmail,
  signInAsGuest,
  signInWithPassword,
  signUp,
} from "./guests/_test-utils/guest-auth";
import { baseAuthConfig, signInDatabaseHooks } from "./server";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

/** Email delivery requires Next's request context; authentication and persistence stay real. */
vi.mock("./plugins/otp", () => ({ sendVerificationOTP: vi.fn() }));

const otpAuth = betterAuth({
  ...baseAuthConfig,
  baseURL: "http://localhost:3000",
  databaseHooks: signInDatabaseHooks,
  plugins: [createEmailOTPPlugin({ storeOTP: "plain" })],
  rateLimit: { enabled: false },
  secret: "auth-events-test-secret-with-enough-entropy",
});

const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: false },
  storeOTP: "plain",
});

function createSignInCode(email: string) {
  return otpAuth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
}

async function signInWithEmailCode(email: string) {
  const otp = await createSignInCode(email);
  const { user } = await otpAuth.api.signInEmailOTP({ body: { email, otp } });

  return user.id;
}

function endpoint(context: Partial<Pick<GenericEndpointContext, "body" | "params" | "path">>) {
  return context as GenericEndpointContext;
}

describe("sign-up events", () => {
  it("reports an account once, as it's created, and never a guest", async () => {
    const sink = vi.fn(() => Promise.resolve());
    registerAuthEventSink(sink);

    const { headers } = await signInAsGuest();
    expect(sink).not.toHaveBeenCalled();

    const email = createTestEmail();
    const { userId } = await signUp({ email, headers });
    await signInWithPassword({ email, headers: new Headers() });

    expect(sink).toHaveBeenCalledExactlyOnceWith({ name: "sign-up", userId });
  });

  it("never fails a sign-up when analytics does", async () => {
    registerAuthEventSink(vi.fn().mockRejectedValue(new Error("PostHog is down")));

    await expect(signUp({ email: createTestEmail() })).resolves.toMatchObject({
      userId: expect.any(String),
    });
  });
});

describe("sign-in events", () => {
  it("reports every email-code sign-in with its method, including the one that creates the account", async () => {
    const sink = vi.fn(() => Promise.resolve());
    registerAuthEventSink(sink);
    const email = createTestEmail();

    const userId = await signInWithEmailCode(email);
    await signInWithEmailCode(email);

    expect(sink.mock.calls).toStrictEqual([
      [{ name: "sign-up", userId }],
      [{ method: "otp", name: "sign-in", userId }],
      [{ method: "otp", name: "sign-in", userId }],
    ]);
  });

  it("names the provider of a browser or native Google or Apple sign-in, and nothing else", async () => {
    const sink = vi.fn(() => Promise.resolve());
    registerAuthEventSink(sink);
    const session = { userId: "learner" };

    await reportSignInAfterSessionCreate(
      session,
      endpoint({ params: { id: "google" }, path: "/callback/:id" }),
    );

    await reportSignInAfterSessionCreate(
      session,
      endpoint({
        body: { idToken: { token: "apple-token" }, provider: "apple" },
        path: "/sign-in/social",
      }),
    );

    await Promise.all(
      ["/sign-in/anonymous", "/one-time-token/verify", "/admin/impersonate-user"].map((path) =>
        reportSignInAfterSessionCreate(session, endpoint({ path })),
      ),
    );

    await reportSignInAfterSessionCreate(session, null);

    expect(sink.mock.calls).toStrictEqual([
      [{ method: "google", name: "sign-in", userId: "learner" }],
      [{ method: "apple", name: "sign-in", userId: "learner" }],
    ]);
  });

  it("never reports the sign-in account deletion makes to prove who's deleting", async () => {
    const [deleting, other] = [createTestEmail(), createTestEmail()];

    const [deletingId] = await Promise.all([
      signInWithEmailCode(deleting),
      signInWithEmailCode(other),
    ]);

    const sink = vi.fn(() => Promise.resolve());
    registerAuthEventSink(sink);

    await reauthorizeEmailForAccountDeletion({
      credentials: { email: deleting, otp: await createSignInCode(deleting) },
      expectedUserId: deletingId,
    });

    await expect(
      reauthorizeEmailForAccountDeletion({
        credentials: { email: other, otp: await createSignInCode(other) },
        expectedUserId: deletingId,
      }),
    ).rejects.toThrow(AccountDeletionEmailMismatchError);

    expect(sink).not.toHaveBeenCalled();
  });

  it("never fails a sign-in when analytics does", async () => {
    registerAuthEventSink(vi.fn().mockRejectedValue(new Error("PostHog is down")));

    await expect(signInWithEmailCode(createTestEmail())).resolves.toStrictEqual(expect.any(String));
  });
});
