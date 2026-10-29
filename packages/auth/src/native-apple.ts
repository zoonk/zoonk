import { prisma } from "@zoonk/db";
import { getAppleClient } from "./native-apple-client";
import { type NativeAppleCredentials } from "./native-apple-contract";
import { type NativeAppleSession, isNativeAppleSession } from "./native-apple-response";
import {
  type NativeAppleAuthAttempt,
  type NativeAppleAuthChanges,
  type NativeAppleSessionRequest,
  enforceNativeAppleSignInRateLimit,
  linkNativeAppleGuest,
  signInWithExistingAppleAccount,
  signInWithNativeAppleAccount,
} from "./native-apple-session";
import {
  type AppleAuthorization,
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

type AppleSessionCreator = (credentials: NativeAppleCredentials) => Promise<NativeAppleAuthAttempt>;

type VerifiedAppleAuthorization = {
  authorization: AppleAuthorization;
  clientIdentifier: string;
  issuer: string;
  subject: string;
};

async function getExactAppleAccount({ subject }: { subject: string }) {
  return prisma.account.findUnique({
    where: { providerId_accountId: { accountId: subject, providerId: "apple" } },
  });
}

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

  // The new user is visible as soon as Better Auth creates it, so another device may already be
  // signed into it; it goes only while no session uses it, checked in the same statement.
  if (changes.userId) {
    await prisma.user.deleteMany({ where: { id: changes.userId, sessions: { none: {} } } });
    return;
  }

  if (changes.accountId) {
    await prisma.account.deleteMany({ where: { id: changes.accountId } });
  }
}

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

async function exchangeVerifiedAuthorization(
  credentials: NativeAppleCredentials,
): Promise<VerifiedAppleAuthorization> {
  const { clientIdentifier, redirectURI } = getAppleClient(credentials.client);

  const originalIdentity = await verifyNativeAppleIdentityToken({
    clientIdentifier,
    nonce: credentials.nonce,
    token: credentials.idToken,
  });

  const authorization = await exchangeNativeAppleAuthorizationCode({
    authorizationCode: credentials.authorizationCode,
    clientIdentifier,
    redirectURI,
  });

  try {
    const exchangedIdentity = await verifyNativeAppleIdentityToken({
      clientIdentifier,
      token: authorization.idToken,
    });

    if (
      originalIdentity.issuer !== exchangedIdentity.issuer ||
      originalIdentity.subject !== exchangedIdentity.subject
    ) {
      throw new NativeAppleAccountError("Apple authorization identities do not match");
    }

    return { ...originalIdentity, authorization, clientIdentifier };
  } catch (error) {
    return throwAfterAppleRevocation({
      authorization,
      clientIdentifier,
      error,
      issuer: originalIdentity.issuer,
      subject: originalIdentity.subject,
    });
  }
}

/** Requires the exact Apple account row first, so email-based linking can't store one person's grant on another's account. */
async function createVerifiedSession({
  credentials,
  createSession,
  verifiedAuthorization,
}: {
  credentials: NativeAppleCredentials;
  createSession: AppleSessionCreator;
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

  if (!isNativeAppleSession(response)) {
    return throwAfterSessionCleanup({
      ...verifiedAuthorization,
      changes,
      error: new Error("Native Apple sign-in did not create a session"),
    });
  }

  const account = await getExactAppleAccount(verifiedAuthorization).catch((error: unknown) =>
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

  return { account, changes, session: response };
}

/** The deletion instance also disables signup, in case this link changes after the check. */
async function requireExpectedAppleAccount({
  expectedUserId,
  verifiedAuthorization,
}: {
  expectedUserId: string;
  verifiedAuthorization: VerifiedAppleAuthorization;
}) {
  const account = await getExactAppleAccount(verifiedAuthorization).catch((error: unknown) =>
    throwAfterAppleRevocation({ ...verifiedAuthorization, error }),
  );

  if (!account || account.userId !== expectedUserId) {
    return throwAfterAppleRevocation({
      ...verifiedAuthorization,
      error: new NativeAppleAccountError("Apple reauthorization does not match the current user"),
    });
  }
}

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

/** Stores Apple's refresh token in plaintext, as Better Auth stores every OAuth account's. */
export async function signInWithNativeApple(request: NativeAppleSessionRequest) {
  const { credentials, headers, requestURL } = request;

  await enforceNativeAppleSignInRateLimit({ headers, requestURL });

  const verifiedAuthorization = await exchangeVerifiedAuthorization(credentials);

  const { account, changes, session } = await createVerifiedSession({
    createSession: (nativeCredentials) =>
      signInWithNativeAppleAccount({ credentials: nativeCredentials, headers }),
    credentials,
    verifiedAuthorization,
  });

  await persistAppleAuthorization({
    accountId: account.id,
    changes,
    session,
    verifiedAuthorization,
  });

  // The sign-in is complete and the account may already be in use elsewhere, so a guest that can't
  // move takes back only this request's session; the guest keeps its progress.
  await linkNativeAppleGuest({ headers, userId: session.user.id }).catch(async (error: unknown) => {
    await prisma.session.deleteMany({ where: { token: session.token } });
    throw error;
  });

  return session;
}

/** Revokes the new Apple refresh token right away; the session only satisfies Better Auth's freshness check. */
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
