import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { redirect, unauthorized } from "next/navigation";

/**
 * Server actions need a hard authorization stop before mutating admin-only data.
 * Throwing keeps these action handlers simple: nothing after this guard runs when
 * the caller is not an admin.
 */
export async function assertAdmin() {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  return session;
}

/**
 * Admin route renders should preserve the existing login redirect while still
 * interrupting non-admin users before admin-only server components read data.
 */
export async function requireAdminRouteAccess() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    unauthorized();
  }

  return session;
}
