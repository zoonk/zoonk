import { SEED_USER_EMAILS } from "./users";
import { listSeedPersonas } from "./v2/learners/seed-personas";

export function listSeedEmails(): string[] {
  const personas = listSeedPersonas({ now: new Date() });

  return [...Object.values(SEED_USER_EMAILS), ...personas.map(({ email }) => email)];
}
