import { listSeedPersonas } from "./learners/seed-personas";
import { SEED_USER_EMAILS } from "./users";

export function listSeedEmails(): string[] {
  const personas = listSeedPersonas({ now: new Date() });

  return [...Object.values(SEED_USER_EMAILS), ...personas.map(({ email }) => email)];
}
