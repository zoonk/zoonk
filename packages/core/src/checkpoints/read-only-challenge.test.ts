import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { listeningBlueprintFixture } from "@zoonk/testing/fixtures/listening";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { type SavedItemFacts } from "../plans/_utils/selected-item-contract";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { toBlockPayload } from "../sessions/block-payload";
import { buildSessionBlocks } from "../sessions/session-builder";
import { getPassMark } from "./checkpoint-rules";
import { getChallenge } from "./get-challenge";
import { startChallenge } from "./start-challenge";

vi.mock("../sessions/session-builder", { spy: true });

async function dueBossFixture(
  bossFor?: (skillIds: string[]) => NonNullable<SavedItemFacts["boss"]>,
) {
  const user = await userFixture();

  const { goal, plan, planItems, skills } = await sessionGoalFixture({
    itemsPerSkill: 10,
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  await prisma.planItem.updateMany({
    data: { completedAt: SESSION_NOW, status: "done" },
    where: { id: { in: planItems.map((item) => item.id) } },
  });

  const item = await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 3 });

  if (bossFor) {
    const boss = bossFor(skills.map((skill) => skill.id));

    const facts: SavedItemFacts = {
      boss,
      minutes: boss.minutes,
      parts: { checkpoint: boss.minutes, practice: 0, unwritten: 0, written: 0 },
      schemaVersion: 1,
      skillIds: boss.testedSkillIds,
    };

    await prisma.planItem.update({ data: { facts }, where: { id: item.id } });
  }

  await layOutPlanFixture(plan.id);
  mockSession(user.id);
  vi.mocked(buildSessionBlocks).mockClear();

  return { boss: item, goal, plan, skills, user };
}

function readPlan(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { changes: true, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

async function savedDayFixture({
  before,
  bossId,
  goalId,
  userId,
}: {
  before: "challenge" | "lessons";
  bossId: string;
  goalId: string;
  userId: string;
}) {
  const session = await studySessionFixture({
    goalId,
    localDate: SESSION_TODAY,
    missions: [],
    userId,
  });

  const checkpoint = {
    kind: "boss",
    mock: false,
    passMark: 0,
    phase: 0,
    rematch: false,
    timeLimitMinutes: null,
  } as const;

  const [earlier] = await Promise.all([
    studySessionBlockFixture({
      kind: before === "lessons" ? "learn" : "checkpoint",
      payload: toBlockPayload({ checkpoint: before === "lessons" ? null : checkpoint }),
      position: 0,
      sessionId: session.id,
    }),
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({ checkpoint, planItemId: bossId }),
      position: 1,
      sessionId: session.id,
    }),
  ]);

  return { earlier, session };
}

function readSavedDay(sessionId: string) {
  return prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: sessionId },
  });
}

async function readIntro(planItemId: string) {
  const read = await getChallenge({ input: { timeZone: "UTC" }, planItemId });

  if (read.status !== "ready") {
    throw new Error("Expected the actual owned challenge intro");
  }

  return read.challenge;
}

describe("a challenge intro is a read", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("offers a due checkpoint without writing, then creates its queue only on Start", async () => {
    const { boss, goal, plan, user } = await dueBossFixture();
    const before = await readPlan(plan.id);
    const challenge = await readIntro(boss.id);

    expect(challenge).toMatchObject({
      blockId: null,
      estimatedMinutes: null,
      minutes: null,
      passMark: null,
      questions: null,
      recordings: 0,
      status: "ready",
      title: "Test boss",
      topics: [],
    });

    expect(vi.mocked(buildSessionBlocks)).not.toHaveBeenCalled();
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(readPlan(plan.id)).resolves.toStrictEqual(before);

    const started = await startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

    if (started.status !== "ready") {
      throw new Error(`Expected Start to open the real checkpoint, got ${started.status}`);
    }

    const block = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: started.destination.blockId },
    });

    expect(block.sessionId).toBe(started.destination.sessionId);
    expect(block.status).toBe("active");
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });

  it("keeps an unknown-size checkpoint upcoming before its day, not waiting", async () => {
    const { boss } = await dueBossFixture();

    await prisma.planItem.update({
      data: { scheduledFor: new Date(SESSION_NOW.getTime() + 2 * DAY_MS) },
      where: { id: boss.id },
    });

    await prisma.planItem.updateMany({
      data: { completedAt: null, status: "todo" },
      where: { kind: "lesson", planId: boss.planId },
    });

    await expect(readIntro(boss.id)).resolves.toMatchObject({
      questions: null,
      status: "upcoming",
      topics: [],
    });
  });

  it("reads the saved waiting state after Start opens a rest day without its due offer", async () => {
    const { boss, goal, plan } = await dueBossFixture();

    await prisma.plan.update({
      data: {
        settings: {
          startDate: new Date(SESSION_NOW.getTime() - DAY_MS).toISOString().slice(0, 10),
          weekdayMinutes: Array.from({ length: 7 }, (_, weekday) =>
            weekday === SESSION_NOW.getUTCDay() ? 0 : goal.dailyMinutes,
          ),
        },
      },
      where: { id: plan.id },
    });

    await expect(readIntro(boss.id)).resolves.toMatchObject({ status: "ready" });
    expect(buildSessionBlocks).not.toHaveBeenCalled();
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toStrictEqual({ status: "notToday" });

    const session = await prisma.studySession.findFirstOrThrow({
      include: { blocks: true },
      where: { goalId: goal.id },
    });

    expect(session.blocks).toHaveLength(0);
    vi.mocked(buildSessionBlocks).mockClear();
    await expect(readIntro(boss.id)).resolves.toMatchObject({ status: "waiting" });
    expect(buildSessionBlocks).not.toHaveBeenCalled();
  });

  it("has nothing to wait for before the day is saved", async () => {
    const { boss, goal } = await dueBossFixture();

    await expect(readIntro(boss.id)).resolves.toMatchObject({ status: "ready", waitReason: null });
    expect(buildSessionBlocks).not.toHaveBeenCalled();
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

  it.each(["lessons", "challenge"] as const)(
    "says a saved day's checkpoint waits for the %s before it, without building or writing",
    async (before) => {
      const { boss, goal, plan, user } = await dueBossFixture();

      const { session } = await savedDayFixture({
        before,
        bossId: boss.id,
        goalId: goal.id,
        userId: user.id,
      });

      const [savedBefore, planBefore] = await Promise.all([
        readSavedDay(session.id),
        readPlan(plan.id),
      ]);

      await expect(readIntro(boss.id)).resolves.toMatchObject({
        status: "ready",
        waitReason: before,
      });

      expect(buildSessionBlocks).not.toHaveBeenCalled();
      await expect(readSavedDay(session.id)).resolves.toStrictEqual(savedBefore);
      await expect(readPlan(plan.id)).resolves.toStrictEqual(planBefore);
      await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);
    },
  );

  it.each(["completed", "skipped"] as const)(
    "stops waiting once the work before it is %s",
    async (status) => {
      const { boss, goal, user } = await dueBossFixture();

      const { earlier } = await savedDayFixture({
        before: "lessons",
        bossId: boss.id,
        goalId: goal.id,
        userId: user.id,
      });

      await prisma.studySessionBlock.update({ data: { status }, where: { id: earlier.id } });

      await expect(readIntro(boss.id)).resolves.toMatchObject({
        status: "ready",
        waitReason: null,
      });

      expect(buildSessionBlocks).not.toHaveBeenCalled();
    },
  );

  it("offers a due checkpoint as its saved plan item keeps it", async () => {
    const { boss, skills } = await dueBossFixture(([first, second = ""]) => ({
      kind: "text",
      minutes: 19,
      questions: 7,
      testedKeys: [],
      testedSkillIds: [second, first ?? ""],
      waiting: false,
    }));

    const challenge = await readIntro(boss.id);

    expect(challenge).toMatchObject({
      estimatedMinutes: 19,
      minutes: 19,
      passMark: getPassMark(7),
      questions: 7,
      status: "ready",
    });

    expect(challenge.topics.map((topic) => topic.name)).toStrictEqual([
      skills[1]?.name,
      skills[0]?.name,
    ]);

    expect(vi.mocked(buildSessionBlocks)).not.toHaveBeenCalled();
  });

  it("keeps a due checkpoint the bank can't ask yet waiting, with no time of its own", async () => {
    const { boss, goal } = await dueBossFixture(() => ({
      kind: "recording",
      minutes: 0,
      questions: null,
      testedKeys: [],
      testedSkillIds: [],
      waiting: true,
    }));

    const challenge = await readIntro(boss.id);

    expect(challenge).toMatchObject({ minutes: 0, questions: 0, status: "waiting", topics: [] });
    expect(vi.mocked(buildSessionBlocks)).not.toHaveBeenCalled();
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

  it("keeps a stored listening offer's playback rule before its recordings are selected", async () => {
    const { boss } = await dueBossFixture((skillIds) => ({
      kind: "recording",
      minutes: 19,
      questions: 7,
      testedKeys: [],
      testedSkillIds: skillIds,
      waiting: false,
    }));

    await expect(readIntro(boss.id)).resolves.toMatchObject({
      minutes: 19,
      passMark: getPassMark(7),
      questions: 7,
      recordings: null,
      status: "ready",
    });

    expect(buildSessionBlocks).not.toHaveBeenCalled();
  });

  it("keeps recording-only skills out of the stored text offer's topics", async () => {
    const { boss, goal, plan, skills } = await dueBossFixture((skillIds) => ({
      kind: "text",
      minutes: 15,
      questions: 10,
      testedKeys: [],
      testedSkillIds: skillIds,
      waiting: false,
    }));

    const blueprint = await listeningBlueprintFixture({ name: `Listening ${crypto.randomUUID()}` });

    await prisma.goal.update({
      data: { examBlueprintId: blueprint.id, kind: "exam", targetLanguage: "en" },
      where: { id: goal.id },
    });

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "Mixed" }],
          skills: skills.map((skill, index) => ({
            area: index === 1 ? "Reading" : "Listening",
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          })),
        },
      },
      where: { id: plan.id },
    });

    const challenge = await readIntro(boss.id);
    expect(challenge.topics.map((topic) => topic.name)).toStrictEqual([skills[1]?.name]);
    expect(buildSessionBlocks).not.toHaveBeenCalled();
  });
});
