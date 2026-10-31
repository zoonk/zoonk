import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { toBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";
import { loadDayMissionFacts } from "./day-facts";
import { pickMissions } from "./pick-missions";
import { rebuildMissions } from "./rebuild-missions";

const LOCAL_DATE = new Date("2026-10-13T00:00:00Z");

async function setupChapter() {
  freezeClock();
  vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));

  const [user, chapter, lesson] = await Promise.all([
    userFixture(),
    libraryChapterFixture(),
    libraryLessonFixture({ estimatedMinutes: 8 }),
  ]);

  const goal = await goalFixture({ dailyMinutes: 20, timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const item = await planItemFixture({
    chapterId: chapter.id,
    lessonId: lesson.id,
    planId: plan.id,
    scheduledFor: LOCAL_DATE,
  });

  const block: PlannedBlock = {
    canDo: null,
    estimatedMinutes: 8,
    kind: "learn",
    lessonId: lesson.id,
    payload: toBlockPayload({ chapterId: chapter.id, planItemId: item.id }),
  };

  const facts = await loadDayMissionFacts({
    blocks: [block],
    goal,
    localDate: LOCAL_DATE,
    plannedMinutes: 8,
    timeZone: "UTC",
    userId: user.id,
  });

  const picks = pickMissions(facts);

  expect(picks).toMatchObject([
    { anchor: { chapterId: chapter.id }, kind: "finishChapter", total: 1 },
  ]);

  const created = await studySessionFixture({
    goalId: goal.id,
    localDate: LOCAL_DATE,
    missions: { picks, version: 1 },
    plannedMinutes: 8,
    userId: user.id,
  });

  await studySessionBlockFixture({ ...block, sessionId: created.id });

  const session = await prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: created.id },
  });

  return { block, chapter, goal, picks, plan, session, user };
}

async function addLesson({
  chapterId,
  planId,
}: {
  chapterId: string;
  planId: string;
}): Promise<PlannedBlock> {
  const lesson = await libraryLessonFixture({ estimatedMinutes: 4 });

  const item = await planItemFixture({
    chapterId,
    lessonId: lesson.id,
    planId,
    scheduledFor: LOCAL_DATE,
  });

  return {
    canDo: null,
    estimatedMinutes: 4,
    kind: "learn",
    lessonId: lesson.id,
    payload: toBlockPayload({ chapterId, planItemId: item.id }),
  };
}

async function rebuild(input: Awaited<ReturnType<typeof setupChapter>>, blocks: PlannedBlock[]) {
  const facts = await loadDayMissionFacts({
    blocks,
    goal: input.goal,
    localDate: LOCAL_DATE,
    plannedMinutes: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
    timeZone: "UTC",
    userId: input.user.id,
  });

  const missions = await rebuildMissions({
    client: prisma,
    facts,
    session: input.session,
    timeZone: "UTC",
  });

  return { facts, missions };
}

describe("stored chapter targets when an unstarted queue changes", () => {
  it("keeps a complete saved chapter when another complete chapter ranks first", async () => {
    const input = await setupChapter();
    const other = await libraryChapterFixture();
    const added = await addLesson({ chapterId: other.id, planId: input.plan.id });
    const { facts, missions } = await rebuild(input, [added, input.block]);

    expect(facts.candidates.find((pick) => pick.kind === "finishChapter")?.anchor.chapterId).toBe(
      other.id,
    );

    expect(missions).toStrictEqual({ picks: input.picks, version: 1 });
  });

  it("drops a saved whole-chapter target when another unfinished lesson joins that chapter", async () => {
    const input = await setupChapter();
    const added = await addLesson({ chapterId: input.chapter.id, planId: input.plan.id });
    const { facts, missions } = await rebuild(input, [input.block, added]);

    expect(facts.candidates.find((pick) => pick.kind === "finishChapter")?.total).toBe(2);

    expect(missions).toMatchObject({
      picks: [{ anchor: { chapterId: input.chapter.id }, kind: "finishChapter", total: 2 }],
      version: 1,
    });

    expect(missions?.picks[0]?.anchor.lessonIds).toStrictEqual([
      input.block.lessonId,
      added.lessonId,
    ]);
  });
});

describe("stored outside targets when an unstarted queue changes", () => {
  it("keeps the original visible call unit and its title when another unit ranks first", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const input = await languageGoalFixture();
    await usageRecordsFixture({ count: 10, kind: "tutorMessage", userId: input.user.id });

    const blocks: PlannedBlock[] = input.items.map((item) => ({
      canDo: null,
      estimatedMinutes: 4,
      kind: "learn",
      lessonId: item.lessonId,
      payload: toBlockPayload({ chapterId: item.chapterId, planItemId: item.id }),
    }));

    const load = (queue: PlannedBlock[]) =>
      loadDayMissionFacts({
        blocks: queue,
        goal: input.goal,
        localDate: LOCAL_DATE,
        plannedMinutes: 16,
        timeZone: "UTC",
        userId: input.user.id,
      });

    const picks = pickMissions(await load(blocks));

    expect(picks).toContainEqual(
      expect.objectContaining({ anchor: { chapterId: input.arriving.id }, kind: "call" }),
    );

    const created = await studySessionFixture({
      goalId: input.goal.id,
      localDate: LOCAL_DATE,
      missions: { picks, version: 1 },
      plannedMinutes: 16,
      userId: input.user.id,
    });

    await Promise.all(
      blocks.map((block, position) =>
        studySessionBlockFixture({ ...block, position, sessionId: created.id }),
      ),
    );

    const session = await prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: created.id },
    });

    const facts = await load([...blocks.slice(2), ...blocks.slice(0, 2)]);

    expect(facts.candidates.find((pick) => pick.kind === "call")?.anchor.chapterId).toBe(
      input.renting.id,
    );

    const rebuilt = await rebuildMissions({ client: prisma, facts, session, timeZone: "UTC" });
    expect(rebuilt).toStrictEqual({ picks, version: 1 });

    await prisma.chapter.delete({ where: { id: input.arriving.id } });
    const deleted = await rebuildMissions({ client: prisma, facts, session, timeZone: "UTC" });

    expect(
      deleted?.picks.some(
        (pick) => pick.kind === "call" && pick.anchor.chapterId === input.arriving.id,
      ),
    ).toBe(false);
  });

  it.each([30, 22])(
    "keeps a three-fix target with one already done and two ready on a %i-minute day",
    async (dailyMinutes) => {
      const input = await setupChapter();
      const skill = await skillFixture();
      const material = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

      await prisma.planItem.updateMany({
        data: { skillId: skill.id },
        where: { planId: input.plan.id },
      });

      const mistakes = await Promise.all(
        Array.from({ length: 5 }, () =>
          mistakeFixture({
            createdAt: new Date("2026-10-01"),
            itemId: material.id,
            skillId: skill.id,
            userId: input.user.id,
          }),
        ),
      );

      const goal = await prisma.goal.update({
        data: { dailyMinutes: 30 },
        where: { id: input.goal.id },
      });

      const load = (currentGoal: typeof goal) =>
        loadDayMissionFacts({
          blocks: [{ ...input.block, estimatedMinutes: 18 }],
          goal: currentGoal,
          localDate: LOCAL_DATE,
          plannedMinutes: 18,
          timeZone: "UTC",
          userId: input.user.id,
        });

      const initial = await load(goal);
      const fix = initial.candidates.find((pick) => pick.kind === "fixMistake");
      expect(fix?.total).toBe(3);
      const picks = [...input.picks, ...(fix ? [fix] : [])];

      await prisma.studySession.update({
        data: { missions: { picks, version: 1 } },
        where: { id: input.session.id },
      });

      await prisma.mistake.update({
        data: { fixedAt: new Date(), status: "fixed" },
        where: { id: mistakes[0]?.id },
      });

      await prisma.mistake.deleteMany({
        where: { id: { in: mistakes.slice(1, 3).map((mistake) => mistake.id) } },
      });

      const changed = await prisma.goal.update({ data: { dailyMinutes }, where: { id: goal.id } });
      const facts = await load(changed);
      expect(facts.readyMistakeCount).toBe(2);

      const session = await prisma.studySession.findUniqueOrThrow({
        include: STUDY_SESSION_INCLUDE,
        where: { id: input.session.id },
      });

      expect(session.startedAt).toBeNull();
      const rebuilt = await rebuildMissions({ client: prisma, facts, session, timeZone: "UTC" });
      expect(rebuilt?.picks.find((pick) => pick.kind === "fixMistake")).toStrictEqual(fix);
    },
  );
});
