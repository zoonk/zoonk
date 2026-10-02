import { type PrismaClient } from "../../../../generated/prisma/client";
import { type EnemEdition } from "../library/enem/enem-edition";
import { guest } from "./personas/guest";
import { type SeedPersonaName, buildPersona } from "./seed-personas";
import { type SeedLearner } from "./types";
import { writeLearner } from "./write-learner";

/**
 * One learner per goal kind (a huge learn goal, an exam with a date, a language and an explain),
 * plus Fun mode with a buddy, a minor and a guest. Sign in as any of them with the seed password.
 */
export async function writeLearners({
  edition,
  now,
  prisma,
}: {
  edition: EnemEdition;
  now: Date;
  prisma: PrismaClient;
}) {
  const write = (learner: SeedLearner) => writeLearner({ learner, now, prisma });

  const persona = (name: SeedPersonaName) => write(buildPersona({ edition, name, now }));

  const [exam, explain, fun, anonymous, hugeGoal, language, minor] = await Promise.all([
    persona("exam"),
    persona("explain"),
    persona("fun"),
    write(guest),
    persona("hugeGoal"),
    persona("language"),
    persona("minor"),
  ]);

  return { exam, explain, fun, guest: anonymous, hugeGoal, language, minor };
}
