import { prisma } from "@zoonk/db";
import { type GenericEndpointContext } from "better-auth";

/**
 * Call before sign-up or sign-in replaces the session cookie. It reads the session store directly,
 * so the lookup never changes the session the running endpoint sees.
 */
export async function findRequestGuest(context: GenericEndpointContext) {
  const token = await context.getSignedCookie(
    context.context.authCookies.sessionToken.name,
    context.context.secret,
  );

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({ include: { user: true }, where: { token } });

  if (!session || session.expiresAt <= new Date() || !session.user.isAnonymous) {
    return null;
  }

  return session.user;
}
