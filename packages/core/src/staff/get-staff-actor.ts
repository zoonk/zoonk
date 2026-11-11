import "server-only";
import { auth } from "@zoonk/auth";
import { STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { headers } from "next/headers";
import { isStaffAccount } from "./staff-account";

function readBearerToken(requestHeaders: Headers): string | null {
  const [scheme, token, ...rest] = requestHeaders.get("authorization")?.trim().split(/\s+/u) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    return null;
  }

  return token;
}

/**
 * The staff member acting in this request, from a CLI access token alone: a Better Auth session
 * never passes, and the platform role and ban are read on every call so losing them applies at once.
 * `forbidden` names the valid login that tried, for the audit log; `unauthorized` names no one,
 * since nothing vouches for an id.
 */
export async function getStaffActor(): Promise<
  { status: "ready" | "forbidden"; userId: string; clientId: string } | { status: "unauthorized" }
> {
  const token = readBearerToken(await headers());

  if (!token) {
    return { status: "unauthorized" };
  }

  const access = await auth.api.verifyCliAccessToken({ body: { token } });

  if (!access) {
    return { status: "unauthorized" };
  }

  const user = await prisma.user.findUnique({ where: { id: access.userId } });

  if (!user) {
    return { status: "unauthorized" };
  }

  if (!access.scopes.includes(STAFF_READ_SCOPE) || !isStaffAccount(user)) {
    return { clientId: access.clientId, status: "forbidden", userId: user.id };
  }

  return { clientId: access.clientId, status: "ready", userId: user.id };
}
