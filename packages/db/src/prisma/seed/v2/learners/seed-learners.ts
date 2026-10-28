import { type PrismaClient } from "../../../../generated/prisma/client";
import { type EnemEdition } from "../library/enem/enem-edition";
import { guest } from "./personas/guest";
import { type SeedPersonaName, buildPersona } from "./seed-personas";
import { type SeedLearner } from "./types";
import { writeLearner } from "./write-learner";

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

  const [buddy, exam, explain, anonymous, hugeGoal, language, stocks] = await Promise.all([
    persona("buddy"),
    persona("exam"),
    persona("explain"),
    write(guest),
    persona("hugeGoal"),
    persona("language"),
    persona("stocks"),
  ]);

  return { buddy, exam, explain, guest: anonymous, hugeGoal, language, stocks };
}
