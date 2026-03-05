import "server-only";
import { getSession } from "@zoonk/core/users/session/get";

export async function assertAdmin() {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function isAdmin() {
  const session = await getSession();
  return session?.user.role === "admin";
}
