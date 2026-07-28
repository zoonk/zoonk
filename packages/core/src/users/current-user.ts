import "server-only";
import { auth } from "@zoonk/auth";
import { normalizeUsername } from "@zoonk/auth/username-rules";
import { type User, prisma } from "@zoonk/db";
import { cacheTag, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { getUserSessionCacheTag } from "../cache/tags";
import { getSession } from "./get-session";

export type CurrentUserUpdate = { name?: string; username?: string };

export type CurrentUser = Pick<
  User,
  | "analyticsDisabled"
  | "createdAt"
  | "displayUsername"
  | "email"
  | "emailVerified"
  | "id"
  | "image"
  | "name"
  | "updatedAt"
  | "username"
>;

/**
 * Projects the database user into the account fields shared with product
 * clients, excluding billing identifiers, moderation state, and auth internals.
 */
function toCurrentUser(user: User): CurrentUser {
  return {
    analyticsDisabled: user.analyticsDisabled,
    createdAt: user.createdAt,
    displayUsername: user.displayUsername,
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    image: user.image,
    name: user.name,
    updatedAt: user.updatedAt,
    username: user.username,
  };
}

/**
 * Loads one trusted user row after the public capability derives identity from
 * the authenticated session.
 */
async function findCurrentUser(userId: string): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toCurrentUser(user) : null;
}

/**
 * Returns the authenticated account resource without accepting an acting user
 * id from an app. The private cache shares the complete read across callers in
 * the same render tree.
 */
export async function getCurrentUser() {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getUserSessionCacheTag(session.user.id));
  return findCurrentUser(session.user.id);
}

/**
 * Omits unchanged profile fields so idempotent updates do not ask the identity
 * provider to rewrite the current username.
 */
function getSessionUserUpdate({
  currentUser,
  input,
}: {
  currentUser: CurrentUser;
  input: CurrentUserUpdate;
}): CurrentUserUpdate {
  return {
    ...(input.name !== undefined && input.name !== currentUser.name && { name: input.name }),
    ...(input.username !== undefined &&
      input.username !== currentUser.username && { username: input.username }),
  };
}

/**
 * Detects whether a partial account patch changes any identity field.
 */
function hasSessionUserUpdate(input: CurrentUserUpdate): boolean {
  return Object.keys(input).length > 0;
}

/**
 * Updates the authenticated account through Better Auth, expires the cached
 * account resource, and returns the fresh public user. Core owns the
 * current-user comparison and apps never pass user IDs.
 */
export async function updateCurrentUser({ input }: { input: CurrentUserUpdate }) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const currentUser = await findCurrentUser(session.user.id);

  if (!currentUser) {
    return null;
  }

  const update = getSessionUserUpdate({ currentUser, input });

  if (!hasSessionUserUpdate(update)) {
    return currentUser;
  }

  await auth.api.updateUser({ body: update, headers: await headers() });

  const user = await findCurrentUser(session.user.id);

  if (!user) {
    return null;
  }

  revalidateTag(getUserSessionCacheTag(user.id), { expire: 0 });

  return user;
}

/**
 * Reuses Better Auth's canonical normalization, reserved-name policy, and
 * uniqueness lookup for the public product endpoint used by profile clients.
 * The later profile update remains authoritative because availability can
 * change between this read and a mutation.
 */
export async function getUsernameAvailability(username: string) {
  const normalizedUsername = normalizeUsername(username);

  const result = await auth.api.isUsernameAvailable({ body: { username: normalizedUsername } });

  return { isAvailable: result.available, username: normalizedUsername };
}
