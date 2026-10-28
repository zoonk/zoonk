import "server-only";
import { auth, reauthorizeEmailForAccountDeletion } from "@zoonk/auth";
import { captureAccountDeletionCleanup } from "@zoonk/auth/account-deletion";
import { type EmailAccountDeletionCredentials } from "@zoonk/auth/email-deletion-contract";
import {
  type NativeAppleCredentials,
  reauthorizeAppleForAccountDeletion,
} from "@zoonk/auth/native-apple";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
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

/** Remove old cookies so Better Auth cannot select a stale session over the fresh reauthentication bearer. */
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

/** Authorize with fresh reauthentication; email reauthentication cannot determine stored Apple grant revocation. */
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

/** null means no Apple account; false means some grant revocation is unconfirmed and requires manual recovery. */
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

/** Failure must remove the temporary session; successful deletion removes it through the user cascade. */
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

/** Retain the deleted account's analytics id for manual removal; logging failure must not fail account deletion. */
async function logAccountDeletion(userId: string) {
  const { error } = await safeAsync(() => prisma.accountDeletion.create({ data: { userId } }));

  if (error) {
    logError("Couldn't log the account deletion; remove its analytics by hand:", userId, error);
  }
}

/** Permanently deletes the session's user through Better Auth's fresh-session checks and cleanup hooks. */
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

    await logAccountDeletion(session.user.id);

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

/** Deletes only when shownUserId still matches the session; a cross-tab account switch returns otherAccount. */
export async function deleteShownAccount({
  shownUserId,
}: {
  shownUserId: string;
}): Promise<"deleted" | "otherAccount"> {
  const session = await getSession();

  if (session?.user.id !== shownUserId) {
    return "otherAccount";
  }

  await deleteCurrentUser({});
  return "deleted";
}
