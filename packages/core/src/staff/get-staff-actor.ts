import "server-only";
import { auth } from "@zoonk/auth";
import { type STAFF_PROPOSE_SCOPE, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
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

type StaffScope = typeof STAFF_PROPOSE_SCOPE | typeof STAFF_READ_SCOPE;

/**
 * The staff member acting in this request, from a CLI access token alone: a Better Auth session
 * never passes, and the platform role and ban are read on every call so losing them applies at once.
 * `forbidden` and `missingScope` name the valid login that tried, for the audit log; `unauthorized`
 * names no one, since nothing vouches for an id. `missingScope` is a staff account whose login was
 * approved before it could ask for `scope`, so logging in again fixes it.
 */
export async function getStaffActor(
  scope: StaffScope = STAFF_READ_SCOPE,
): Promise<
  | { status: "ready" | "forbidden" | "missingScope"; userId: string; clientId: string }
  | { status: "unauthorized" }
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

  if (!isStaffAccount(user)) {
    return { clientId: access.clientId, status: "forbidden", userId: user.id };
  }

  if (!access.scopes.includes(scope)) {
    return { clientId: access.clientId, status: "missingScope", userId: user.id };
  }

  return { clientId: access.clientId, status: "ready", userId: user.id };
}
