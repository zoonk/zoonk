import "server-only";
import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { headers } from "next/headers";
import { getSession } from "../users/get-session";
import { isStaffAccount } from "./staff-account";

/** The provider's codes are capital letters and digits; its check accepts them in any case and with separators. */
function toProviderUserCode(userCode: string): string {
  return userCode.replaceAll(/[^a-z0-9]/giu, "").toUpperCase();
}

/**
 * Approves or denies a CLI login the signed-in person already claimed with the provider's
 * rate-limited check (`GET /device`), so this never looks up a code anyone else could be waiting on.
 * A login that asks for any staff scope needs a staff account: without one it's denied instead, so
 * the CLI stops waiting rather than getting a token every staff route refuses.
 */
export async function decideCliLogin({
  decision,
  userCode,
}: {
  decision: "approve" | "deny";
  userCode: string;
}): Promise<{ status: "approved" | "denied" | "needsStaff" | "notFound" | "unauthorized" }> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const [login, user] = await Promise.all([
    prisma.deviceCode.findFirst({
      select: { scope: true, userCode: true },
      where: {
        expiresAt: { gt: new Date() },
        status: "pending",
        userCode: toProviderUserCode(userCode),
        userId: session.user.id,
      },
    }),
    prisma.user.findUnique({
      select: { banned: true, role: true },
      where: { id: session.user.id },
    }),
  ]);

  if (!user) {
    return { status: "unauthorized" };
  }

  if (!login) {
    return { status: "notFound" };
  }

  const asksForStaff = login.scope?.split(" ").some((scope) => scope.startsWith("staff:")) ?? false;
  const needsStaff = asksForStaff && !isStaffAccount(user);

  const request = { body: { userCode: login.userCode }, headers: await headers() };

  if (decision === "deny" || needsStaff) {
    await auth.api.deviceDeny(request);
    return { status: needsStaff ? "needsStaff" : "denied" };
  }

  await auth.api.deviceApprove(request);
  return { status: "approved" };
}
