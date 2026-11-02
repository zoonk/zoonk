import "server-only";
import { auth } from "@zoonk/auth";
import { findAvailableUsername } from "@zoonk/auth/available-username";
import { normalizeUsername } from "@zoonk/auth/username-rules";
import { type User, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { headers } from "next/headers";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
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

async function findCurrentUser(userId: string): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toCurrentUser(user) : null;
}

/** Returns the session's account; its private cache shares reads only within the render tree. */
export async function getCurrentUser() {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getUserSessionCacheTag(session.user.id));
  return findCurrentUser(session.user.id);
}

/** Better Auth must not rewrite an unchanged username. */
function getSessionUserUpdate({
  currentUser,
  input,
}: {
  currentUser: CurrentUser;
  input: CurrentUserUpdate;
}): CurrentUserUpdate {
  const username = input.username === undefined ? undefined : normalizeUsername(input.username);

  return {
    ...(input.name !== undefined && input.name !== currentUser.name && { name: input.name }),
    ...(username !== undefined && username !== currentUser.username && { username }),
  };
}

function hasSessionUserUpdate(input: CurrentUserUpdate): boolean {
  return Object.keys(input).length > 0;
}

/** Requires sign-in; updates through Better Auth and returns the fresh account after cache invalidation. */
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

  revalidateCacheTags([getUserSessionCacheTag(user.id)]);

  return user;
}

/** Uses Better Auth's username rules; availability is advisory because the later update is authoritative. */
export async function getUsernameAvailability(username: string) {
  const normalizedUsername = normalizeUsername(username);

  const result = await auth.api.isUsernameAvailable({ body: { username: normalizedUsername } });

  return { isAvailable: result.available, username: normalizedUsername };
}

/** Returns null without a session or when all email-derived names are taken. */
export async function suggestCurrentUsername(): Promise<string | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const currentUser = await findCurrentUser(session.user.id);

  if (!currentUser) {
    return null;
  }

  return currentUser.username ?? findAvailableUsername(currentUser.email);
}
