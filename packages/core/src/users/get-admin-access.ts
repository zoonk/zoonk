import "server-only";
import { getSession } from "./get-session";

export async function getAdminAccess(): Promise<"forbidden" | "ready" | "unauthorized"> {
  const session = await getSession();

  if (!session) {
    return "unauthorized";
  }

  return session.user.role === "admin" ? "ready" : "forbidden";
}
