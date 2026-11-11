import "server-only";
import { CLI_CLIENT_ID } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getAdminAccess } from "../users/get-admin-access";

/**
 * Ends every CLI login a person has, as the remote kill switch for a lost machine. The provider's
 * refresh tokens carry no link between a login's renewals, so one machine can't be singled out:
 * it would escape by renewing between the admin's list and the revoke. The person logs in again on
 * the machines they still have.
 */
export async function revokeCliLoginsForAdmin(
  userId: string,
): Promise<{ status: "forbidden" | "notFound" | "ready" | "unauthorized" }> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!isUuid(userId)) {
    return { status: "notFound" };
  }

  const where = { clientId: CLI_CLIENT_ID, userId };

  const [accessTokens, refreshTokens] = await prisma.$transaction([
    prisma.oauthAccessToken.deleteMany({ where }),
    prisma.oauthRefreshToken.deleteMany({ where }),
  ]);

  return { status: accessTokens.count + refreshTokens.count > 0 ? "ready" : "notFound" };
}
