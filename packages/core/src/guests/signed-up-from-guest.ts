import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";

/**
 * Whether the account that just signed up carries a guest's learning: signing up as a guest moves
 * the guest's goals and lessons to the new account before it finishes setup, and a new account
 * has none of its own yet. "Sign Up Completed" reports it as `from_guest`.
 */
export async function signedUpFromGuest(): Promise<boolean> {
  const session = await getSession();

  if (!session) {
    return false;
  }

  const where = { userId: session.user.id };

  const [goal, event] = await Promise.all([
    prisma.goal.findFirst({ select: { id: true }, where }),
    prisma.learningEvent.findFirst({ select: { id: true }, where }),
  ]);

  return Boolean(goal ?? event);
}
