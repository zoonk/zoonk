import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type PrismaClient } from "../../../generated/prisma/client";
import { writeLearners } from "./learners/seed-learners";
import { type SeedPersonaName, buildPersona } from "./learners/seed-personas";
import { writeLearner } from "./learners/write-learner";
import { writeEnemBlueprint } from "./library/enem/enem-blueprint";
import { enemCourse } from "./library/enem/enem-course";
import { getEnemEdition, getPlannedEnemEdition } from "./library/enem/enem-edition";
import { englishCourse } from "./library/english/english-course";
import { physicsCourse } from "./library/physics/physics-course";
import { stockMarketCourse } from "./library/stock-market/stock-market-course";
import { writeLibraryCourse } from "./library/write-course";

const LIBRARY_COURSES = [physicsCourse, enemCourse, stockMarketCourse, englishCourse] as const;

/**
 * Seeds Zoonk v2: hand-written Library courses in English and Brazilian Portuguese, and one
 * learner per goal kind with their plans, sessions and history. Every row has a stable id or key,
 * so it runs on top of an existing database (local dev, the test database or E2E setup) and
 * running it again only brings the rows up to date.
 */
export async function seedV2(prisma: PrismaClient) {
  const now = new Date();

  // Items point at the blueprint of the exam they're written for, so it goes first.
  await writeEnemBlueprint({ edition: getEnemEdition(now), now, prisma });

  const organization = await prisma.organization.upsert({
    create: { name: "Zoonk AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });

  await Promise.all(
    LIBRARY_COURSES.map((course) =>
      writeLibraryCourse({ course, organizationId: organization.id, prisma }),
    ),
  );

  return { learners: await writeLearners({ edition: getPlannedEnemEdition(now), now, prisma }) };
}

/**
 * Writes an independent copy of one persona under its own key and email, so a test can change the
 * learner's plan, answers or profile without touching the shared personas other tests read. Run
 * `seedV2` first: the copy points at its Library content. A minor's copy gets a guardian of its
 * own, so the persona's guardian doesn't collect every copy as another learner.
 */
export async function seedV2PersonaCopy(
  prisma: PrismaClient,
  { copyKey, email, persona }: { copyKey: string; email: string; persona: SeedPersonaName },
) {
  const now = new Date();
  const learner = buildPersona({ edition: getPlannedEnemEdition(now), name: persona, now });

  const guardian = learner.guardian && {
    ...learner.guardian,
    email: `guardian-${copyKey}@zoonk.test`,
  };

  return writeLearner({
    learner: { ...learner, email, guardian, key: `${learner.key}:copy:${copyKey}`, username: null },
    now,
    prisma,
  });
}
