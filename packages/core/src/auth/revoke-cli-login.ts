import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getAdminAccess } from "../users/get-admin-access";

/**
 * Ends one machine's CLI login, as the remote kill switch for a lost machine. A login is its
 * current refresh token; deleting it takes the access tokens issued with it, and that machine's next
 * refresh fails as unknown. Marking it revoked instead would make that refresh look like a stolen
 * token, and the OAuth provider then ends every CLI login the person has on every machine.
 * `notFound` covers a login that refreshed or ended since the admin's list was read.
 */
export async function revokeCliLoginForAdmin(
  loginId: string,
): Promise<{ status: "forbidden" | "notFound" | "ready" | "unauthorized" }> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!isUuid(loginId)) {
    return { status: "notFound" };
  }

  const { count } = await prisma.oauthRefreshToken.deleteMany({
    where: { id: loginId, revoked: null },
  });

  return { status: count > 0 ? "ready" : "notFound" };
}
