import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../../../users/get-session";
import { isStaffAccount } from "../../staff-account";

export type StaffSessionRefusal = { status: "forbidden" | "unauthorized" };

/**
 * The staff person behind this request's Better Auth session, read fresh, so a CLI token, a lost
 * admin role or a ban never passes.
 */
export async function getStaffSessionUser(): Promise<
  StaffSessionRefusal | { status: "ready"; userId: string }
> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const user = await prisma.user.findUnique({
    select: { banned: true, id: true, role: true },
    where: { id: session.user.id },
  });

  if (!user) {
    return { status: "unauthorized" };
  }

  return isStaffAccount(user) ? { status: "ready", userId: user.id } : { status: "forbidden" };
}
