import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningBlueprintFixture, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { lockPlanSourceWrite, writePlanInputs } from "../library/_utils/plan-input-write";
import { type SavedItemFacts } from "../plans/_utils/selected-item-contract";
import { getGoalPlan } from "../plans/get-goal-plan";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { readStudyDay } from "../sessions/_utils/read-study-day";
import { readBlockPayload, toBlockPayload } from "../sessions/block-payload";
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

  it("offers Today's admitted recording after its saved waiting offer becomes stale", async () => {
    const { boss, goal, plan, skills, user } = await dueBossFixture((skillIds) => ({
      kind: "recording",
      minutes: 0,
      questions: null,
      testedKeys: [],
      testedSkillIds: skillIds,
      waiting: true,
    }));

    const blueprint = await listeningBlueprintFixture({ name: `Listening ${crypto.randomUUID()}` });

    const [currentGoal, recording] = await Promise.all([
      prisma.goal.update({
        data: { examBlueprintId: blueprint.id, kind: "exam", targetLanguage: "en" },
        where: { id: goal.id },
      }),
      listeningSetFixture({ examBlueprintId: blueprint.id }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ name: "Basics" }],
            skills: skills.map((skill) => ({
              area: "Listening",
              lessons: 1,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: null,
            })),
          },
        },
        where: { id: plan.id },
      }),
    ]);

    await Promise.all(
      Array.from({ length: 5 }, (_, setPosition) =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          format: "multipleChoice",
          setId: recording.id,
          setPosition,
          skillId: skills[0]!.id,
        }),
      ),
    );

    const unheard = await readStudyDay({
      goal: currentGoal,
      now: SESSION_NOW,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(unheard?.session.blocks.some((block) => block.kind === "checkpoint")).toBe(false);

    await expect(readIntro(boss.id)).resolves.toMatchObject({
      minutes: 0,
      questions: 0,
      status: "waiting",
    });

    const audio = await mediaAssetFixture({ durationMs: 40_000, kind: "audio" });

    await writePlanInputs(async (tx) => {
      await lockPlanSourceWrite(tx, { blueprintIds: [blueprint.id], skillIds: [skills[0]!.id] });

      await tx.itemSet.updateMany({
        data: { mediaAssetId: audio.id },
        where: { id: recording.id, mediaAssetId: null },
      });
    });

    const before = await readPlan(plan.id);

    const read = await countDatabaseStatements(async () => {
      const [today, view, screen] = await Promise.all([
        readStudyDay({ goal: currentGoal, now: SESSION_NOW, timeZone: "UTC", userId: user.id }),
        getGoalPlan(goal.id),
        readIntro(boss.id),
      ]);

      return { screen, today, view };
    });

    expect(read.writes).toBe(0);
    await expect(readPlan(plan.id)).resolves.toStrictEqual(before);
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    const held = read.result.today?.session.blocks.find((block) => block.kind === "checkpoint");
    expect(held?.estimatedMinutes).toBe(8);
    expect(read.result.screen).toMatchObject({ minutes: 8, questions: 5, status: "ready" });

    if (read.result.view.status !== "ready") {
      throw new Error("Expected the Plan");
    }

    expect(read.result.view.plan.phases.flatMap((phase) => phase.checkpoint ?? [])).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ planItemId: boss.id, when: "nextSession" }),
      ]),
    );

    const started = await startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });
    expect(started.status).toBe("ready");
    await expect(readIntro(boss.id)).resolves.toMatchObject({ minutes: 8, questions: 5 });
  });

  it.each([
    { minutes: 0, prepared: false },
    { minutes: 45, prepared: false },
    { minutes: 0, prepared: true },
    { minutes: 45, prepared: true },
  ])(
    "keeps Today's carried challenge after midnight with $minutes minutes and today's day prepared: $prepared",
    async ({ minutes, prepared }) => {
      const { boss, goal, plan, user } = await dueBossFixture((skillIds) => ({
        kind: "text",
        minutes: 15,
        questions: 10,
        testedKeys: [],
        testedSkillIds: skillIds,
        waiting: false,
      }));

      await prisma.plan.update({
        data: { settings: { weekdayMinutes: [45, 45, 45, 45, minutes, 45, 45] } },
        where: { id: plan.id },
      });

      vi.setSystemTime(new Date("2026-09-30T23:50:00Z"));
      const opened = await startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

      if (opened.status !== "ready") {
        throw new Error("Expected a started challenge");
      }

      vi.setSystemTime(new Date("2026-10-01T00:05:00Z"));

      if (prepared) {
        const session = await studySessionFixture({
          goalId: goal.id,
          localDate: new Date("2026-10-01"),
          userId: user.id,
        });

        const original = await prisma.studySessionBlock.findUniqueOrThrow({
          where: { id: opened.destination.blockId },
        });

        await studySessionBlockFixture({
          kind: "checkpoint",
          payload: readBlockPayload(original),
          sessionId: session.id,
        });
      }

      const [today, view, screen] = await Promise.all([
        readStudyDay({ goal, now: new Date(), timeZone: "UTC", userId: user.id }),
        getGoalPlan(goal.id),
        readIntro(boss.id),
      ]);

      const resumed = await startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });
      expect(today?.session.localDate).toStrictEqual(SESSION_TODAY);

      expect(today?.session.blocks).toStrictEqual(
        expect.arrayContaining([expect.objectContaining({ id: opened.destination.blockId })]),
      );

      expect(resumed).toMatchObject({ destination: opened.destination, status: "ready" });

      if (view.status !== "ready") {
        throw new Error("Expected the Plan");
      }

      const checkpoint = view.plan.phases
        .flatMap((phase) => phase.checkpoint ?? [])
        .find((entry) => entry.planItemId === boss.id);

      expect.soft(checkpoint?.when).toBe("nextSession");
      expect(screen).toMatchObject({ blockId: opened.destination.blockId, status: "started" });
    },
  );

  it("dates a reached challenge left outside today's saved session from the Plan's timing", async () => {
    const { boss, goal, user } = await dueBossFixture((skillIds) => ({
      kind: "text",
      minutes: 15,
      questions: 10,
      testedKeys: [],
      testedSkillIds: skillIds,
      waiting: false,
    }));

    await prisma.planItem.update({
      data: { scheduledFor: new Date("2027-01-16") },
      where: { id: boss.id },
    });

    await studySessionFixture({ goalId: goal.id, localDate: SESSION_TODAY, userId: user.id });

    await expect(readIntro(boss.id)).resolves.toMatchObject({
      date: "2026-10-01",
      status: "upcoming",
    });
  });

  it("previews only the later phase topics Start asks once reached", async () => {
    const user = await userFixture();

    const { goal, plan, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 10,
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    await prisma.planItem.update({
      data: { completedAt: SESSION_NOW, status: "done" },
      where: { id: planItems[0]!.id },
    });

    await prisma.planItem.updateMany({
      data: { phase: 1 },
      where: { id: { in: [planItems[1]!.id, planItems[2]!.id] } },
    });

    const boss = await checkpointItemFixture({
      kind: "boss",
      phase: 1,
      planId: plan.id,
      position: 3,
    });

    const { bosses } = await layOutPlanFixture(plan.id);

    await prisma.planItem.updateMany({
      data: { completedAt: SESSION_NOW, status: "done" },
      where: { id: { in: bosses.map((earlier) => earlier.id) } },
    });

    mockSession(user.id);

    const preview = await readIntro(boss.id);

    await prisma.planItem.updateMany({
      data: { completedAt: SESSION_NOW, status: "done" },
      where: { id: { in: [planItems[1]!.id, planItems[2]!.id] } },
    });

    const started = await startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

    if (started.status !== "ready") {
      throw new Error(`Expected Start to open the real checkpoint, got ${started.status}`);
    }

    const block = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: started.destination.blockId },
    });

    const names = new Map(skills.map((skill) => [skill.id, skill.name]));
    const asked = readBlockPayload(block).skillIds.map((id) => names.get(id));

    expect({ asked, previewed: preview.topics.map((topic) => topic.name) }).toStrictEqual({
      asked,
      previewed: asked,
    });
  });

  it("previews unskipped teaching before an unreached challenge without expanding a reached offer", async () => {
    const { boss, plan, skills } = await dueBossFixture(() => ({
      kind: "text",
      minutes: 0,
      questions: 0,
      testedKeys: [],
      testedSkillIds: [],
      waiting: true,
    }));

    await prisma.planItem.updateMany({
      data: { completedAt: null, status: "todo" },
      where: { kind: "lesson", planId: plan.id },
    });

    await prisma.planItem.updateMany({
      data: { status: "skipped" },
      where: { kind: "lesson", planId: plan.id, skillId: skills[1]!.id },
    });

    const challenge = await readIntro(boss.id);

    expect(challenge.topics.map((topic) => topic.name)).toStrictEqual([
      skills[0]!.name,
      skills[2]!.name,
    ]);
  });

  it("offers a legacy offer today's day holds without writing, then establishes its queue on Start", async () => {
    const { boss, goal, plan, skills, user } = await dueBossFixture();
    const before = await readPlan(plan.id);
    const challenge = await readIntro(boss.id);

    expect(challenge).toMatchObject({
      blockId: null,
      estimatedMinutes: 15,
      minutes: 15,
      passMark: getPassMark(10),
      questions: 10,
      recordings: 0,
      status: "ready",
      title: "Test boss",
      topics: skills.map((skill) => ({ name: skill.name, subject: null })),
      waitReason: null,
    });

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

  it("keeps an unknown-size checkpoint today's day doesn't hold upcoming, not waiting", async () => {
    const { boss, goal, skills } = await dueBossFixture();

    await Promise.all([
      prisma.planItem.update({
        data: { scheduledFor: new Date(SESSION_NOW.getTime() + 2 * DAY_MS) },
        where: { id: boss.id },
      }),
      prisma.plan.update({
        data: {
          settings: {
            weekdayMinutes: Array.from({ length: 7 }, (_, weekday) =>
              weekday === SESSION_NOW.getUTCDay() ? 0 : goal.dailyMinutes,
            ),
          },
        },
        where: { id: boss.planId },
      }),
    ]);

    await prisma.planItem.updateMany({
      data: { completedAt: null, status: "todo" },
      where: { kind: "lesson", planId: boss.planId },
    });

    await expect(readIntro(boss.id)).resolves.toMatchObject({
      questions: null,
      status: "upcoming",
      topics: skills.map((skill) => ({ name: skill.name, subject: null })),
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

    await expect(readIntro(boss.id)).resolves.toMatchObject({ status: "waiting" });
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
        waitReason: before === "lessons" ? "lessons" : null,
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

  it.each(["text", "recording"] as const)(
    "keeps a stored %s estimate when Today's day does not hold the challenge",
    async (kind) => {
      const { boss, goal, plan, skills } = await dueBossFixture(([first, second = ""]) => ({
        kind,
        minutes: 19,
        questions: 7,
        testedKeys: [],
        testedSkillIds: [second, first ?? ""],
        waiting: false,
      }));

      await prisma.plan.update({
        data: { settings: { weekdayMinutes: [45, 45, 45, 0, 45, 45, 45] } },
        where: { id: plan.id },
      });

      const challenge = await readIntro(boss.id);

      expect(challenge).toMatchObject({
        estimatedMinutes: 19,
        minutes: 19,
        passMark: getPassMark(7),
        questions: 7,
        recordings: kind === "recording" ? null : 0,
        status: "upcoming",
      });

      expect(challenge.topics.map((topic) => topic.name)).toStrictEqual([
        skills[1]?.name,
        skills[0]?.name,
      ]);

      await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    },
  );

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
  });
});
