import { SEED_USER_EMAILS } from "./users";
import { listSeedPersonas } from "./v2/learners/seed-personas";

/** The email of every account the seed writes: the base users, the v2 personas and the guest. */
export function listSeedEmails(): string[] {
  const personas = listSeedPersonas({ now: new Date() });

  return [...Object.values(SEED_USER_EMAILS), ...personas.map(({ email }) => email)];
}
