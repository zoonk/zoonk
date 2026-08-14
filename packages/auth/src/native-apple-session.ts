import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth/minimal";
import { type BetterAuthOptions } from "better-auth/types";
import { type NativeAppleCredentials } from "./native-apple-contract";
import { getNativeAppleProvider } from "./providers/apple";
import { baseAuthConfig, baseAuthPlugins } from "./server";
import { stripePlugin } from "./stripe/plugin";

export type NativeAppleAuthChanges = { accountId?: string; sessionToken?: string; userId?: string };

const nativeAppleAuthChanges = new AsyncLocalStorage<NativeAppleAuthChanges>();
const baseUserCreateAfter = baseAuthConfig.databaseHooks?.user?.create?.after;

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
    plugins: [...baseAuthPlugins, stripePlugin({ createCustomerOnSignUp: false })],
    rateLimit: { enabled: true, storage: "database" },
    socialProviders: nativeAppleProvider,
  });
}

const nativeAppleAuth = createNativeAppleAuth({ disableSignUp: false });
const existingAppleAccountAuth = createNativeAppleAuth({ disableSignUp: true });

type NativeAppleAuthResponse = Awaited<ReturnType<typeof nativeAppleAuth.api.signInSocial>>;

export type NativeAppleAuthAttempt =
  | { changes: NativeAppleAuthChanges; response: NativeAppleAuthResponse; success: true }
  | { changes: NativeAppleAuthChanges; error: unknown; success: false };

/**
 * Runs one provider assertion inside request-local change tracking. If Better
 * Auth fails after creating any local auth rows, the caller receives their
 * exact IDs so it can roll back only this sign-in attempt.
 */
async function attemptNativeAppleSignIn({
  auth,
  credentials,
}: {
  auth: typeof nativeAppleAuth;
  credentials: NativeAppleCredentials;
}): Promise<NativeAppleAuthAttempt> {
  const changes: NativeAppleAuthChanges = {};

  return nativeAppleAuthChanges.run(changes, async () => {
    try {
      const response = await auth.api.signInSocial({
        body: {
          idToken: { nonce: credentials.nonce, token: credentials.idToken, user: credentials.user },
          provider: "apple",
        },
      });

      return { changes: { ...changes }, response, success: true };
    } catch (error) {
      return { changes: { ...changes }, error, success: false };
    }
  });
}

/** Runs normal native Apple login with signup enabled and rollback metadata captured. */
export function signInWithNativeAppleAccount(credentials: NativeAppleCredentials) {
  return attemptNativeAppleSignIn({ auth: nativeAppleAuth, credentials });
}

/** Creates a fresh session for a linked Apple account without permitting signup. */
export function signInWithExistingAppleAccount(credentials: NativeAppleCredentials) {
  return attemptNativeAppleSignIn({ auth: existingAppleAccountAuth, credentials });
}
