import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type PrismaClient } from "../../../generated/prisma/client";
import { type SeedLanguage } from "./_utils/localize";
import { buildPersonaOn } from "./learners/persona-day";
import { writeLearners } from "./learners/seed-learners";
import { type SeedPersonaName } from "./learners/seed-personas";
import { writeLearner } from "./learners/write-learner";
import { getSeedPlus } from "./learners/write-user";
import { writeEnemBlueprint } from "./library/enem/enem-blueprint";
import { enemCourse } from "./library/enem/enem-course";
import { getEnemEdition, getPlannedEnemEdition } from "./library/enem/enem-edition";
import { englishCourse } from "./library/english/english-course";
import { physicsCourse } from "./library/physics/physics-course";
import { stockMarketCourse } from "./library/stock-market/stock-market-course";
import { writeLibraryCourse } from "./library/write-course";

export { type SeedCourse } from "./library/types";
export { writeLibraryCourse } from "./library/write-course";
export {
  type PastCheckpoint,
  type PastResult,
  type SeededPast,
} from "./learners/write-past-sessions";
export { type SeededToday } from "./learners/write-session";

const LIBRARY_COURSES = [physicsCourse, enemCourse, stockMarketCourse, englishCourse] as const;

/**
 * Writes Zoonk v2's seed: hand-written Library courses in English and Brazilian Portuguese, and
 * one learner per goal kind with their sessions, history and what they did of their plans. The
 * planner lays out the rest of each plan, which only core can run: seed through `seedV2` in
 * `@zoonk/core/seed/v2`. Every row has a stable id or key, so it runs on top of an existing
 * database (local dev, the test database or E2E setup) and running it again only brings the rows
 * up to date. Returns the learners and the moment they're written on.
 */
export async function writeSeedV2(prisma: PrismaClient) {
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

  const learners = await writeLearners({ edition: getPlannedEnemEdition(now), now, prisma });
  return { learners, now };
}

/**
 * Writes an independent copy of one persona under its own key and email, so a test can change the
 * learner's plan, answers or profile without touching the shared personas other tests read. Run
 * `writeSeedV2` first: the copy points at its Library content. As with `writeSeedV2`, the planner
 * lays out the rest of its plan: copy through `seedV2PersonaCopy` in `@zoonk/core/seed/v2`.
 *
 * The copy can be on another day of its plan (`day`, day 1 being the day the plan was made), back
 * after days without studying (`awayDays`), and have another plan, time zone or language. The
 * persona's own words, such as its goal as typed and its memory, stay in its own language. Without
 * a `username`, signing in through the web asks for one first.
 */
export async function writeSeedV2PersonaCopy(
  prisma: PrismaClient,
  {
    awayDays,
    copyKey,
    day,
    email,
    language,
    persona,
    plus,
    timeZone,
    username = null,
  }: {
    awayDays?: number;
    copyKey: string;
    day?: number;
    email: string;
    language?: SeedLanguage;
    persona: SeedPersonaName;
    plus?: boolean;
    timeZone?: string;
    username?: string | null;
  },
) {
  const { learner, now } = buildPersonaOn({ awayDays, day, name: persona, now: new Date() });
  const { course } = learner.goal;
  const copyLanguage = language ?? learner.language;

  if (!course.languages.includes(copyLanguage)) {
    throw new Error(
      `${learner.name}'s course is written in ${course.languages.join(" and ")}, not ${copyLanguage}.`,
    );
  }

  const copy = await writeLearner({
    learner: {
      ...learner,
      email,
      key: `${learner.key}:copy:${copyKey}`,
      language: copyLanguage,
      plus: plus ?? learner.plus,
      timeZone: timeZone ?? learner.timeZone,
      username,
    },
    now,
    prisma,
  });

  return { ...copy, now };
}

/** Gives a learner the Plus seeded personas have, such as a copy of an onboarded learner. */
export async function seedV2Plus(
  prisma: PrismaClient,
  { now, userId }: { now: Date; userId: string },
) {
  await prisma.subscription.create({ data: getSeedPlus({ now, userId }) });
}
