import { AsyncLocalStorage } from "node:async_hooks";
import { type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { type BetterAuthOptions } from "better-auth/types";
import { z } from "zod";
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

/**
 * Builds an Apple-only Better Auth boundary for native ID-token sign-in. The
 * deletion variant disables signup. Both variants retain profile hooks but
 * defer Stripe customer creation until checkout so a failed native provider
 * transaction has no external billing resource to roll back.
 */
function createNativeAppleAuth({ disableSignUp }: { disableSignUp: boolean }) {
  const appleProvider = getNativeAppleProvider();

  const nativeAppleProvider = appleProvider.apple
    ? { apple: { ...appleProvider.apple, disableSignUp } }
    : {};

  return betterAuth({
    ...baseAuthConfig,
    databaseHooks: nativeAppleDatabaseHooks,
    plugins: [
      ...baseAuthPlugins,
      stripePlugin({ createCustomerOnSignUp: false }),
      nativeAppleRateLimitPlugin(),
    ],
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

/**
 * Runs one provider assertion inside request-local change tracking. If Better
 * Auth fails after creating any local auth rows, the caller receives their
 * exact IDs so it can roll back only this sign-in attempt.
 */
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

/** Rejects over-limit Apple attempts before consuming their single-use provider grant. */
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

/** Creates the normal native Apple session after the request has passed its rate-limit gate. */
export function signInWithNativeAppleAccount({
  credentials,
  headers,
}: Pick<NativeAppleSessionRequest, "credentials" | "headers">) {
  return attemptNativeAppleSignIn({
    signIn: () =>
      nativeAppleAuth.api.signInSocial({ body: getNativeAppleSignInBody(credentials), headers }),
  });
}

/** Creates a fresh session for a linked Apple account without permitting signup. */
export function signInWithExistingAppleAccount(credentials: NativeAppleCredentials) {
  return attemptNativeAppleSignIn({
    signIn: () =>
      existingAppleAccountAuth.api.signInSocial({ body: getNativeAppleSignInBody(credentials) }),
  });
}
