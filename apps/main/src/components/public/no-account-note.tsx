import { getSession } from "@zoonk/core/users/session";
import { type ReactNode, Suspense } from "react";

async function NoAccountNoteContent({ children }: { children: ReactNode }) {
  const session = await getSession();
  return session && !session.user.isAnonymous ? null : children;
}

/**
 * A note for people without an account yet, such as "No account needed for your first lesson": a
 * learner with one is already in, so public pages leave it out for them. It streams in after the
 * page, which stays static.
 */
export function NoAccountNote({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <NoAccountNoteContent>{children}</NoAccountNoteContent>
    </Suspense>
  );
}
