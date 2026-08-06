import { prisma } from "@zoonk/db";
import { type NativeAppleCredentials } from "./native-apple-contract";
import {
  type NativeAppleAuthAttempt,
  type NativeAppleAuthChanges,
  signInWithExistingAppleAccount,
  signInWithNativeAppleAccount,
} from "./native-apple-session";
import { getAppleConfiguration } from "./providers/apple";
import {
  type AppleAuthorization,
  AppleAuthorizationError,
  exchangeNativeAppleAuthorizationCode,
  revokeAppleToken,
} from "./providers/apple-rest";
import { verifyNativeAppleIdentityToken } from "./providers/apple-token";

export { AppleAuthorizationError } from "./providers/apple-rest";
export type { NativeAppleCredentials } from "./native-apple-contract";

export class NativeAppleAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeAppleAccountError";
  }
}

type NativeAppleSession = { token: string; user: { id: string } };

type AppleSessionCreator = (credentials: NativeAppleCredentials) => Promise<NativeAppleAuthAttempt>;

type VerifiedAppleAuthorization = {
  authorization: AppleAuthorization;
  clientIdentifier: string;
  subject: string;
};

/**
 * Requires native Apple configuration at the orchestration boundary so token
 * revocation always uses the same bundle identifier as the code exchange.
 */
function getNativeClientIdentifier() {
  const configuration = getAppleConfiguration();

  if (!configuration) {
    throw new AppleAuthorizationError("configuration");
  }

  return configuration.appBundleIdentifier;
}

/**
 * Finds exactly one Apple account for the verified provider subject. Treating
 * duplicates as invalid avoids choosing an arbitrary owner when legacy data is
 * inconsistent.
 */
async function getExactAppleAccount(subject: string) {
  const accounts = await prisma.account.findMany({
    where: { accountId: subject, providerId: "apple" },
  });

  if (accounts.length !== 1) {
    return null;
  }

  return accounts[0];
}

/**
 * Revokes a newly issued Apple refresh token before surfacing an error. This
 * prevents a failed Zoonk sign-in from leaving an unused Apple authorization
 * active on the user's account.
 */
async function throwAfterAppleRevocation({
  authorization,
  clientIdentifier,
  error,
}: VerifiedAppleAuthorization & { error: unknown }): Promise<never> {
  try {
    await revokeAppleToken({
      clientIdentifier,
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    });
  } catch (revocationError) {
    // oxlint-disable-next-line eslint/preserve-caught-error -- AggregateError preserves the caught revocation failure both in its errors list and as its explicit cause.
    throw new AggregateError(
      [error, revocationError],
      "Apple authorization cleanup failed after native sign-in",
      { cause: revocationError },
    );
  }

  throw error;
}

/**
 * Reverses only the rows captured by the request-local Better Auth hooks. A
 * failed new signup removes that user through local cascades; a failed link to
 * an existing user removes only the new Apple account; an ordinary existing
 * sign-in removes only its temporary session. The Apple-only Better Auth
 * boundary deliberately defers Stripe customer creation until checkout, so
 * this rollback never owns or deletes an external billing relationship.
 */
async function rollbackNativeAppleAuthChanges({
  changes,
  responseSessionToken,
}: {
  changes: NativeAppleAuthChanges;
  responseSessionToken?: string;
}) {
  const sessionTokens = [
    ...new Set(
      [changes.sessionToken, responseSessionToken].filter((token): token is string =>
        Boolean(token),
      ),
    ),
  ];

  if (sessionTokens.length > 0) {
    await prisma.session.deleteMany({ where: { token: { in: sessionTokens } } });
  }

  if (changes.userId) {
    await prisma.user.deleteMany({ where: { id: changes.userId } });
    return;
  }

  if (changes.accountId) {
    await prisma.account.deleteMany({ where: { id: changes.accountId } });
  }
}

/**
 * Rolls back local auth changes and revokes the provider grant before
 * surfacing a native sign-in failure. Cleanup errors are retained alongside
 * the original failure so an incomplete rollback is never hidden.
 */
async function throwAfterSessionCleanup({
  authorization,
  changes,
  clientIdentifier,
  error,
  responseSessionToken,
}: VerifiedAppleAuthorization & {
  changes: NativeAppleAuthChanges;
  error: unknown;
  responseSessionToken?: string;
}): Promise<never> {
  const cleanupResults = await Promise.allSettled([
    rollbackNativeAppleAuthChanges({ changes, responseSessionToken }),
    revokeAppleToken({
      clientIdentifier,
      token: authorization.refreshToken,
      tokenType: "refresh_token",
    }),
  ]);

  const cleanupErrors = cleanupResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason as unknown);

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      [error, ...cleanupErrors],
      "Native Apple session and authorization cleanup failed",
      { cause: error },
    );
  }

  throw error;
}

/**
 * Exchanges Apple's single-use native code and proves that both tokens in the
 * Authentication Services result describe the same Apple account. A mismatch
 * revokes the exchanged authorization before it can be used.
 */
async function exchangeVerifiedAuthorization(
  credentials: NativeAppleCredentials,
): Promise<VerifiedAppleAuthorization> {
  const clientIdentifier = getNativeClientIdentifier();

  const originalIdentity = await verifyNativeAppleIdentityToken({
    nonce: credentials.nonce,
    token: credentials.idToken,
  });

  const authorization = await exchangeNativeAppleAuthorizationCode({
    authorizationCode: credentials.authorizationCode,
  });

  try {
    const exchangedIdentity = await verifyNativeAppleIdentityToken({
      token: authorization.idToken,
    });

    if (originalIdentity.subject !== exchangedIdentity.subject) {
      throw new NativeAppleAccountError("Apple authorization identities do not match");
    }

    return { authorization, clientIdentifier, subject: originalIdentity.subject };
  } catch (error) {
    return throwAfterAppleRevocation({
      authorization,
      clientIdentifier,
      error,
      subject: originalIdentity.subject,
    });
  }
}

/**
 * Uses Better Auth's established account-linking rules to create the Zoonk
 * session, then requires the exact Apple account row before any provider token
 * is stored. This prevents email-based linking from persisting one person's
 * Apple grant on another person's account.
 */
async function createVerifiedSession({
  credentials,
  createSession = signInWithNativeAppleAccount,
  verifiedAuthorization,
}: {
  credentials: NativeAppleCredentials;
  createSession?: AppleSessionCreator;
  verifiedAuthorization: VerifiedAppleAuthorization;
}) {
  const attempt = await createSession(credentials);

  if (!attempt.success) {
    return throwAfterSessionCleanup({
      ...verifiedAuthorization,
      changes: attempt.changes,
      error: attempt.error,
    });
  }

  const { changes, response } = attempt;

  if (!("token" in response) || !("user" in response) || !response.token) {
    return throwAfterSessionCleanup({
      ...verifiedAuthorization,
      changes,
      error: new NativeAppleAccountError("Native Apple sign-in did not create a session"),
    });
  }

  const account = await getExactAppleAccount(verifiedAuthorization.subject).catch(
    (error: unknown) =>
      throwAfterSessionCleanup({
        ...verifiedAuthorization,
        changes,
        error,
        responseSessionToken: response.token,
      }),
  );

  if (!account || account.userId !== response.user.id) {
    return throwAfterSessionCleanup({
      ...verifiedAuthorization,
      changes,
      error: new NativeAppleAccountError("Apple account does not belong to the authenticated user"),
      responseSessionToken: response.token,
    });
  }

  return { account, changes, session: response as NativeAppleSession };
}

/**
 * Verifies that the Apple subject is already linked to the account requesting
 * deletion before any social sign-in runs. The dedicated Better Auth instance
 * still disables signup to close the race if that link changes afterward.
 */
async function requireExpectedAppleAccount({
  expectedUserId,
  verifiedAuthorization,
}: {
  expectedUserId: string;
  verifiedAuthorization: VerifiedAppleAuthorization;
}) {
  const account = await getExactAppleAccount(verifiedAuthorization.subject).catch(
    (error: unknown) => throwAfterAppleRevocation({ ...verifiedAuthorization, error }),
  );

  if (!account || account.userId !== expectedUserId) {
    return throwAfterAppleRevocation({
      ...verifiedAuthorization,
      error: new NativeAppleAccountError("Apple reauthorization does not match the current user"),
    });
  }
}

/**
 * Persists the native grant on Better Auth's existing Account row and cleans
 * up both credentials if the database write cannot complete.
 */
async function persistAppleAuthorization({
  accountId,
  changes,
  session,
  verifiedAuthorization,
}: {
  accountId: string;
  changes: NativeAppleAuthChanges;
  session: NativeAppleSession;
  verifiedAuthorization: VerifiedAppleAuthorization;
}) {
  try {
    await prisma.account.update({
      data: {
        accessToken: verifiedAuthorization.authorization.accessToken,
        accessTokenExpiresAt: new Date(
          Date.now() + verifiedAuthorization.authorization.expiresIn * 1000,
        ),
        idToken: verifiedAuthorization.authorization.idToken,
        refreshToken: verifiedAuthorization.authorization.refreshToken,
      },
      where: { id: accountId },
    });
  } catch (error) {
    return throwAfterSessionCleanup({
      ...verifiedAuthorization,
      changes,
      error,
      responseSessionToken: session.token,
    });
  }
}

/**
 * Completes native Sign in with Apple while retaining Apple's refresh token on
 * Better Auth's existing Account model. Better Auth's current storage contract
 * is plaintext, so this deliberately stays compatible with all existing OAuth
 * accounts until token encryption receives its own migration plan.
 */
export async function signInWithNativeApple(credentials: NativeAppleCredentials) {
  const verifiedAuthorization = await exchangeVerifiedAuthorization(credentials);

  const { account, changes, session } = await createVerifiedSession({
    credentials,
    verifiedAuthorization,
  });

  await persistAppleAuthorization({
    accountId: account.id,
    changes,
    session,
    verifiedAuthorization,
  });

  return session;
}

/**
 * Creates a fresh Zoonk session from a new Apple authorization, proves it is
 * the currently authenticated account, and immediately revokes the Apple
 * refresh token. The returned session can satisfy Better Auth's freshness
 * requirement without retaining another provider grant during deletion.
 */
export async function reauthorizeAppleForAccountDeletion({
  credentials,
  expectedUserId,
}: {
  credentials: NativeAppleCredentials;
  expectedUserId: string;
}) {
  const verifiedAuthorization = await exchangeVerifiedAuthorization(credentials);
  await requireExpectedAppleAccount({ expectedUserId, verifiedAuthorization });

  const { changes, session } = await createVerifiedSession({
    createSession: signInWithExistingAppleAccount,
    credentials,
    verifiedAuthorization,
  });

  if (session.user.id !== expectedUserId) {
    return throwAfterSessionCleanup({
      ...verifiedAuthorization,
      changes,
      error: new NativeAppleAccountError("Apple reauthorization does not match the current user"),
      responseSessionToken: session.token,
    });
  }

  try {
    await revokeAppleToken({
      clientIdentifier: verifiedAuthorization.clientIdentifier,
      token: verifiedAuthorization.authorization.refreshToken,
      tokenType: "refresh_token",
    });

    return { appleAuthorizationRevoked: true, sessionToken: session.token } as const;
  } catch {
    return { appleAuthorizationRevoked: false, sessionToken: session.token } as const;
  }
}
