import "server-only";
import { getSession } from "./get-session";

/** Whether the session may run an admin-only command: signed in, then an admin. */
export async function getAdminAccess(): Promise<"forbidden" | "ready" | "unauthorized"> {
  const session = await getSession();

  if (!session) {
    return "unauthorized";
  }

  return session.user.role === "admin" ? "ready" : "forbidden";
}
