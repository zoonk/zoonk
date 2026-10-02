import { type MasteryState, Prisma } from "../../../../generated/prisma/client";
import { seedId } from "../_utils/seed-id";
import { toLearnerSkillMemory } from "./memory-presets";
import { type SeedBlock } from "./types";
import { type LearnerScope, planItemId, scopeDay } from "./write-goal";
import { studyMoment } from "./write-learning";

/** Energy the learner had when the session started, a little below where it ends. */
const ENERGY_GAINED_TODAY = 3;

/** The plan item a learn block works through, so finishing it checks the item off. */
function findPlanItemId(scope: LearnerScope, lessonKey: string | undefined): string | null {
  const { goal } = scope.learner;
  const position = goal.plan.items.findIndex((item) => item.lesson === lessonKey);

  return lessonKey && position !== -1 ? planItemId(scope.learner, goal, position) : null;
}

/** The block's payload as the session builder writes it: plain ids fixed when the day was built. */
function toPayload(scope: LearnerScope, block: SeedBlock): Prisma.InputJsonObject {
  const { learner, lookup } = scope;
  const lesson = block.lesson ? lookup.lesson(block.lesson) : null;

  const capsules = (block.capsules ?? []).map((capsule) => {
    const skillIds = capsule.skills.map((skill) => lookup.skill(skill));
    const lessonId = capsule.lesson ? lookup.lesson(capsule.lesson).id : null;

    return {
      format: capsule.format ?? "rapidFire",
      itemIds: capsule.items.map((item) => lookup.item(item)),
      key: lessonId ?? `skill:${skillIds[0] ?? ""}`,
      lessonId,
      skillIds,
      title: capsule.title,
    };
  });

  const skillIds = block.skills
    ? block.skills.map((skill) => lookup.skill(skill))
    : (lesson?.skillIds ?? capsules.flatMap((capsule) => capsule.skillIds));

  return {
    capsules,
    chapterId: lesson?.chapterId ?? null,
    checkpoint: null,
    drills: (block.drills ?? []).map((drill) => ({
      itemIds: drill.items.map((item) => lookup.item(item)),
      mistakeId: seedId(`learner:${learner.key}:mistake:${drill.mistake}`),
    })),
    extra: false,
    itemIds: (block.items ?? []).map((item) => lookup.item(item)),
    planItemId: findPlanItemId(scope, block.lesson),
    reinforcement: false,
    skillIds,
    title: block.title ?? lesson?.title ?? null,
  };
}

/**
 * Where the learner stood when the session's first block started, so its end can say what
 * changed: Brain Power, Energy and each skill's state.
 */
function toStartSnapshot(scope: LearnerScope): Prisma.InputJsonObject {
  const { learner, lookup, now } = scope;

  const earnedToday = learner.session.blocks.reduce(
    (sum, block) => sum + (block.brainPower ?? 0),
    0,
  );

  const skillStates: Record<string, MasteryState> = Object.fromEntries(
    learner.skills.map(({ memory, skill }) => [
      lookup.skill(skill),
      toLearnerSkillMemory(memory, now).state,
    ]),
  );

  return {
    brainPower: learner.brainPower - earnedToday,
    energy: learner.history.energy - ENERGY_GAINED_TODAY,
    masteryRewards: {},
    preparation: null,
    skillStates,
  };
}

async function writeBlocks(scope: LearnerScope, sessionId: string) {
  const { learner, lookup, prisma } = scope;
  const { blocks } = learner.session;

  const minutesBefore = (position: number) =>
    blocks.slice(0, position).reduce((sum, block) => sum + block.minutes, 0);

  const blockIds = await Promise.all(
    blocks.map(async (block, position) => {
      const blockId = seedId(`learner:${learner.key}:session:today:block:${position}`);
      const lesson = block.lesson ? lookup.lesson(block.lesson) : null;
      const isStarted = block.status === "completed" || block.status === "active";

      const data = {
        brainPower: block.status === "completed" ? (block.brainPower ?? 0) : 0,
        canDo: lesson?.canDo ?? null,
        completedAt:
          block.status === "completed" ? studyMoment(scope, 0, minutesBefore(position + 1)) : null,
        estimatedMinutes: block.minutes,
        kind: block.kind,
        lessonId: lesson?.id ?? null,
        payload: toPayload(scope, block),
        position,
        sessionId,
        startedAt: isStarted ? studyMoment(scope, 0, minutesBefore(position)) : null,
        status: block.status,
      };

      await prisma.studySessionBlock.upsert({
        create: { id: blockId, ...data },
        update: data,
        where: { id: blockId },
      });

      return blockId;
    }),
  );

  await prisma.studySessionBlock.deleteMany({ where: { id: { notIn: blockIds }, sessionId } });
}

/**
 * Today's study session for the active goal, with its blocks in the shape the session builder
 * writes. The id is stable, so each run moves the seeded session to today; a session the app
 * built for today takes its place only until the seed runs again.
 */
export async function writeTodaySession(scope: LearnerScope, goalId: string): Promise<string> {
  const { learner, prisma, userId } = scope;
  const { blocks, status } = learner.session;
  const id = seedId(`learner:${learner.key}:session:today`);
  const localDate = scopeDay(scope, 0);
  const startedAt = status === "planned" ? null : studyMoment(scope, 0);

  const doneMinutes = blocks
    .filter((block) => block.status === "completed")
    .reduce((sum, block) => sum + block.minutes, 0);

  const data = {
    endedAt: status === "completed" && startedAt ? studyMoment(scope, 0, doneMinutes) : null,
    goalId,
    localDate,
    plannedMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
    startSnapshot: startedAt ? toStartSnapshot(scope) : Prisma.DbNull,
    startedAt,
    status,
    userId,
  };

  // One session per learner, goal and day: the seeded one replaces any other for today.
  await prisma.studySession.deleteMany({ where: { goalId, id: { not: id }, localDate, userId } });
  await prisma.studySession.upsert({ create: { id, ...data }, update: data, where: { id } });
  await writeBlocks(scope, id);

  return id;
}
