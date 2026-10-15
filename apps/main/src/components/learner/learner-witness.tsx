import { getLearnerHintTag } from "@zoonk/auth/learner-hint-tag";
import { getSession } from "@zoonk/core/users/session";
import { LearnerWitnessMark } from "./learner-witness-mark";

/**
 * Says whose session a private boundary was rendered for, as the session hint's opaque tag, so a
 * page that shows another learner than the browser holds is covered and reloaded. It reads the
 * same session the boundary's own read did (the session read is cached per render), and draws
 * nothing for a visitor. Render it first in every independently delivered or later-revealed
 * private boundary, its learner-scoped gate and error branches included
 * (`witness-inventory.test.ts` keeps the list whole).
 */
export async function LearnerWitness() {
  const session = await getSession();

  return session ? <LearnerWitnessMark tag={await getLearnerHintTag(session.user.id)} /> : null;
}
