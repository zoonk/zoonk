import { type auth } from "@zoonk/auth";
import { parseNumericId } from "@zoonk/utils/number";

type RawUserSession = Awaited<ReturnType<typeof auth.api.getSession>>;
type AuthenticatedUserSession = NonNullable<RawUserSession>;

type UserSession = Omit<AuthenticatedUserSession, "session" | "user"> & {
  session: Omit<AuthenticatedUserSession["session"], "userId"> & {
    userId: number;
  };
  user: Omit<AuthenticatedUserSession["user"], "id"> & {
    id: number;
  };
};

/**
 * Convert auth ids to numbers once so the rest of the app can follow the same
 * numeric id contract as Prisma and our domain code.
 *
 * Better Auth exposes ids as strings even when the underlying records use
 * numeric columns. Centralizing the conversion here avoids repeating
 * `Number(...)` at every call site and keeps session consumers aligned with the
 * database types they query against.
 */
export function serializeUserSession(session: RawUserSession): UserSession | null {
  if (!session) {
    return null;
  }

  return {
    ...session,
    session: {
      ...session.session,
      userId: serializeSessionId(session.session.userId),
    },
    user: {
      ...session.user,
      id: serializeSessionId(session.user.id),
    },
  };
}

/**
 * Fail fast when auth returns an id shape we cannot safely use with Prisma.
 *
 * Every consumer of `getSession()` treats these ids as numeric foreign keys. If
 * we silently propagate an invalid string, the failure would happen later in a
 * query with much less context about where the mismatch started.
 */
function serializeSessionId(id: number | string): number {
  const serializedId = parseNumericId(id);

  if (serializedId === null) {
    throw new TypeError(`Invalid auth id: ${id}`);
  }

  return serializedId;
}
