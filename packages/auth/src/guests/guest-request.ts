import { prisma } from "@zoonk/db";
import { type GenericEndpointContext } from "better-auth";

/**
 * Finds the guest behind the request's session cookie (the bearer plugin turns a bearer token into
 * the same cookie) before sign-up or sign-in replaces it. It reads the session store directly, so
 * looking up the guest never changes the session the running endpoint sees.
 */
export async function findRequestGuest(context: GenericEndpointContext) {
  const token = await context.getSignedCookie(
    context.context.authCookies.sessionToken.name,
    context.context.secret,
  );

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    include: { user: { include: { learningProfile: true } } },
    where: { token },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isAnonymous) {
    return null;
  }

  return session.user;
}
