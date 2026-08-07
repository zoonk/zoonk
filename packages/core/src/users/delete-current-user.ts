import "server-only";
import { auth, reauthorizeEmailForAccountDeletion } from "@zoonk/auth";
import { captureAccountDeletionCleanup } from "@zoonk/auth/account-deletion";
import { type EmailAccountDeletionCredentials } from "@zoonk/auth/email-deletion-contract";
import {
  type NativeAppleCredentials,
  reauthorizeAppleForAccountDeletion,
} from "@zoonk/auth/native-apple";
import { prisma } from "@zoonk/db";
import { headers } from "next/headers";
import { getSession } from "./get-session";

type AccountDeletionAuthorization = {
  headers: Headers;
  reauthenticatedAppleAuthorizationRevoked?: boolean;
  temporarySessionToken?: string;
};

type AccountDeletionCredentials =
  | { appleCredentials: NativeAppleCredentials; emailCredentials?: never }
  | { appleCredentials?: never; emailCredentials: EmailAccountDeletionCredentials }
  | { appleCredentials?: never; emailCredentials?: never };

/**
 * Creates request headers that contain only the fresh bearer session returned
 * by provider reauthentication. Removing an older cookie prevents Better Auth
 * from selecting a stale browser session over the new credential.
 */
function getFreshBearerHeaders({
  requestHeaders,
  token,
}: {
  requestHeaders: Headers;
  token: string;
}) {
  const freshHeaders = new Headers(requestHeaders);
  freshHeaders.delete("cookie");
  freshHeaders.set("authorization", `Bearer ${token}`);
  return freshHeaders;
}

/**
 * Chooses the fresh email or Apple session that will authorize deletion. The
 * provider cleanup hook reports stored Apple revocation separately after the
 * deletion begins, so email reauthentication does not guess that outcome.
 */
async function getAccountDeletionAuthorization({
  appleCredentials,
  emailCredentials,
  requestHeaders,
  userId,
}: {
  appleCredentials?: NativeAppleCredentials;
  emailCredentials?: EmailAccountDeletionCredentials;
  requestHeaders: Headers;
  userId: string;
}): Promise<AccountDeletionAuthorization> {
  if (emailCredentials) {
    const result = await reauthorizeEmailForAccountDeletion({
      credentials: emailCredentials,
      expectedUserId: userId,
    });

    return {
      headers: getFreshBearerHeaders({ requestHeaders, token: result.sessionToken }),
      temporarySessionToken: result.sessionToken,
    };
  }

  const appleAccount = await prisma.account.findFirst({ where: { providerId: "apple", userId } });

  if (!appleAccount) {
    return { headers: requestHeaders };
  }

  if (!appleCredentials) {
    return { headers: requestHeaders };
  }

  const result = await reauthorizeAppleForAccountDeletion({
    credentials: appleCredentials,
    expectedUserId: userId,
  });

  return {
    headers: getFreshBearerHeaders({ requestHeaders, token: result.sessionToken }),
    reauthenticatedAppleAuthorizationRevoked: result.appleAuthorizationRevoked,
    temporarySessionToken: result.sessionToken,
  };
}

/**
 * Combines every Apple grant cleanup attempted during this deletion. Null means
 * no Apple account was linked; false means at least one fresh or stored grant
 * could not be confirmed revoked and the client should show manual recovery.
 */
function getAppleAuthorizationRevocationResult({
  reauthenticated,
  stored,
}: {
  reauthenticated?: boolean;
  stored: boolean | null;
}) {
  const outcomes = [reauthenticated, stored].filter(
    (outcome): outcome is boolean => typeof outcome === "boolean",
  );

  return outcomes.length > 0 ? outcomes.every(Boolean) : null;
}

/**
 * Removes a fresh reauthentication session when Better Auth cannot finish the
 * deletion. Successful deletion removes the same session through the User
 * cascade, so cleanup is only needed on the failure path.
 */
async function throwAfterTemporarySessionCleanup({
  error,
  sessionToken,
}: {
  error: unknown;
  sessionToken: string;
}): Promise<never> {
  try {
    await prisma.session.deleteMany({ where: { token: sessionToken } });
  } catch (cleanupError) {
    throw new Error("Account deletion reauthentication session cleanup failed", {
      cause: cleanupError,
    });
  }

  throw error;
}

/**
 * Permanently deletes the authenticated user through Better Auth's sensitive
 * operation boundary. Better Auth resolves the acting user from the request,
 * checks the authoritative session, and rejects sessions older than freshAge
 * before its cleanup hook or database deletion can run.
 */
export async function deleteCurrentUser({
  appleCredentials,
  emailCredentials,
}: AccountDeletionCredentials) {
  const [requestHeaders, session] = await Promise.all([headers(), getSession()]);

  if (!session) {
    const cleanup = await captureAccountDeletionCleanup(() =>
      auth.api.deleteUser({ body: {}, headers: requestHeaders }),
    );

    return { appleAuthorizationRevoked: cleanup.appleAuthorizationRevoked };
  }

  const authorization = await getAccountDeletionAuthorization({
    appleCredentials,
    emailCredentials,
    requestHeaders,
    userId: session.user.id,
  });

  try {
    const cleanup = await captureAccountDeletionCleanup(() =>
      auth.api.deleteUser({ body: {}, headers: authorization.headers }),
    );

    return {
      appleAuthorizationRevoked: getAppleAuthorizationRevocationResult({
        reauthenticated: authorization.reauthenticatedAppleAuthorizationRevoked,
        stored: cleanup.appleAuthorizationRevoked,
      }),
    };
  } catch (error) {
    if (authorization.temporarySessionToken) {
      return throwAfterTemporarySessionCleanup({
        error,
        sessionToken: authorization.temporarySessionToken,
      });
    }

    throw error;
  }
}
