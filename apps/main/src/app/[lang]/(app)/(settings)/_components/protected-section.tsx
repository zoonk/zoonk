import { AuthGate } from "@/components/auth-gate";
import { getSession } from "@zoonk/core/users/session";

/**
 * A settings section for people with a session, under the page's own title. Visitors get the gate
 * in its place; guests too, unless the section is theirs as well (`allowGuests`), since a guest's
 * session isn't an account yet.
 */
export async function ProtectedSection({
  allowGuests = false,
  children,
  next,
}: {
  allowGuests?: boolean;
  children: React.ReactNode;
  /** The page to come back to after logging in. */
  next: string;
}) {
  const session = await getSession();

  if (!session || (session.user.isAnonymous && !allowGuests)) {
    return <AuthGate next={next} />;
  }

  return children;
}
