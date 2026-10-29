import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@zoonk/db";
import { type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins";
import { type BetterAuthOptions } from "better-auth/types";
import { z } from "zod";
import { linkGuestAccount } from "./guests/link-guest-account";
import { type NativeAppleCredentials } from "./native-apple-contract";
import { callNativeAuthHandler } from "./native-auth-handler";
import { getNativeAppleProvider } from "./providers/apple";
import { baseAuthConfig, baseAuthPlugins } from "./server";
import { stripePlugin } from "./stripe/plugin";

export type NativeAppleAuthChanges = { accountId?: string; sessionToken?: string; userId?: string };

const nativeAppleAuthChanges = new AsyncLocalStorage<NativeAppleAuthChanges>();
const baseUserCreateAfter = baseAuthConfig.databaseHooks?.user?.create?.after;

function nativeAppleRateLimitPlugin() {
  return {
    endpoints: {
      checkNativeAppleRateLimit: createAuthEndpoint(
        "/sign-in/native-apple",
        { body: z.object({}).strict(), method: "POST" },
        (context) => context.json({ allowed: true }),
      ),
    },
    id: "native-apple-rate-limit",
  } satisfies BetterAuthPlugin;
}

const nativeAppleDatabaseHooks = {
  ...baseAuthConfig.databaseHooks,
  account: {
    ...baseAuthConfig.databaseHooks?.account,
    create: {
      ...baseAuthConfig.databaseHooks?.account?.create,
      after: async (account, context) => {
        const changes = nativeAppleAuthChanges.getStore();

        if (changes) {
          changes.accountId = account.id;
        }

        await baseAuthConfig.databaseHooks?.account?.create?.after?.(account, context);
      },
    },
  },
  session: {
    ...baseAuthConfig.databaseHooks?.session,
    create: {
      ...baseAuthConfig.databaseHooks?.session?.create,
      after: async (session, context) => {
        const changes = nativeAppleAuthChanges.getStore();

        if (changes) {
          changes.sessionToken = session.token;
        }

        await baseAuthConfig.databaseHooks?.session?.create?.after?.(session, context);
      },
    },
  },
  user: {
    ...baseAuthConfig.databaseHooks?.user,
    create: {
      ...baseAuthConfig.databaseHooks?.user?.create,
      after: async (user, context) => {
        const changes = nativeAppleAuthChanges.getStore();

        if (changes) {
          changes.userId = user.id;
        }

        await baseUserCreateAfter?.(user, context);
      },
    },
  },
} satisfies BetterAuthOptions["databaseHooks"];

/** The bearer plugin reads the guest a sign-in may carry (`linkNativeAppleGuest`). */
function createNativeAppleAuth({ disableSignUp }: { disableSignUp: boolean }) {
  const appleProvider = getNativeAppleProvider();

  const nativeAppleProvider = appleProvider.apple
    ? { apple: { ...appleProvider.apple, disableSignUp } }
    : {};

  return betterAuth({
    ...baseAuthConfig,
    databaseHooks: nativeAppleDatabaseHooks,
    plugins: [...baseAuthPlugins, bearer(), stripePlugin(), nativeAppleRateLimitPlugin()],
    rateLimit: { enabled: true, storage: "database" },
    socialProviders: nativeAppleProvider,
  });
}

const nativeAppleAuth = createNativeAppleAuth({ disableSignUp: false });
const existingAppleAccountAuth = createNativeAppleAuth({ disableSignUp: true });

export type NativeAppleAuthAttempt =
  | { changes: NativeAppleAuthChanges; response: unknown; success: true }
  | { changes: NativeAppleAuthChanges; error: unknown; success: false };

export type NativeAppleSessionRequest = {
  credentials: NativeAppleCredentials;
  headers: Headers;
  requestURL: string;
};

async function attemptNativeAppleSignIn({
  signIn,
}: {
  signIn: () => Promise<unknown>;
}): Promise<NativeAppleAuthAttempt> {
  const changes: NativeAppleAuthChanges = {};

  return nativeAppleAuthChanges.run(changes, async () => {
    try {
      const response = await signIn();

      return { changes: { ...changes }, response, success: true };
    } catch (error) {
      return { changes: { ...changes }, error, success: false };
    }
  });
}

function getNativeAppleSignInBody(credentials: NativeAppleCredentials) {
  return {
    idToken: { nonce: credentials.nonce, token: credentials.idToken, user: credentials.user },
    provider: "apple",
  } as const;
}

/** Call before signing in: an over-limit attempt must not consume Apple's single-use grant. */
export async function enforceNativeAppleSignInRateLimit({
  headers,
  requestURL,
}: Omit<NativeAppleSessionRequest, "credentials">) {
  await callNativeAuthHandler({
    body: {},
    handler: nativeAppleAuth.handler,
    headers,
    path: "/sign-in/native-apple",
    requestURL,
  });
}

export function signInWithNativeAppleAccount({
  credentials,
  headers,
}: Pick<NativeAppleSessionRequest, "credentials" | "headers">) {
  return attemptNativeAppleSignIn({
    signIn: () =>
      nativeAppleAuth.api.signInSocial({ body: getNativeAppleSignInBody(credentials), headers }),
  });
}

export function signInWithExistingAppleAccount(credentials: NativeAppleCredentials) {
  return attemptNativeAppleSignIn({
    signIn: () =>
      existingAppleAccountAuth.api.signInSocial({ body: getNativeAppleSignInBody(credentials) }),
  });
}

/** Call only once the sign-in can't roll back: deleting a new account would delete what moved. A failed move changes nothing. */
export async function linkNativeAppleGuest({
  headers,
  userId,
}: {
  headers: Headers;
  userId: string;
}) {
  const current = await nativeAppleAuth.api.getSession({
    headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });

  const guest = current
    ? await prisma.user.findUnique({
        select: { id: true },
        where: { id: current.user.id, isAnonymous: true },
      })
    : null;

  if (guest) {
    await linkGuestAccount({ account: { id: userId }, guestUserId: guest.id });
  }
}
