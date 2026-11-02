import "server-only";
import { getSession } from "@zoonk/core/users/session";
import { redirect, unauthorized } from "next/navigation";

export async function assertAdmin() {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  return session;
}

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
