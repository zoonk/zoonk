import { type StudyBlockKind, prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type BlockCheckpoint, toBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";
import { loadDayMissionFacts } from "./day-facts";
import { pickMissions } from "./pick-missions";

const localDate = new Date("2026-10-13T00:00:00Z");
const now = new Date("2026-10-13T12:00:00Z");
const earlierDate = new Date("2026-10-12T00:00:00Z");

function block(kind: StudyBlockKind, payload = toBlockPayload({})): PlannedBlock {
  return { canDo: null, estimatedMinutes: 5, kind, lessonId: null, payload };
}

async function fixture() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  await planItemFixture({ planId: plan.id, skillId: skill.id });
  return { goal, plan, skill, userId: user.id };
}

async function load(
  input: Awaited<ReturnType<typeof fixture>>,
  blocks: PlannedBlock[],
  dailyMinutes = 30,
) {
  const goal = await prisma.goal.update({ data: { dailyMinutes }, where: { id: input.goal.id } });
  const plannedMinutes = blocks.reduce((sum, entry) => sum + entry.estimatedMinutes, 0);

  return loadDayMissionFacts({
    ...input,
    blocks,
    goal,
    localDate,
    now,
    plannedMinutes,
    timeZone: "UTC",
  });
}

async function experienced(input: Awaited<ReturnType<typeof fixture>>) {
  await studySessionFixture({
    goalId: input.goal.id,
    localDate: earlierDate,
    startedAt: now,
    userId: input.userId,
  });
}

async function mistakes(input: Awaited<ReturnType<typeof fixture>>, count: number) {
  const item = await itemFixture({ content: choiceItemContent(), skillId: input.skill.id });

  await Promise.all(
    Array.from({ length: count }, () =>
      mistakeFixture({
        createdAt: earlierDate,
        itemId: item.id,
        skillId: input.skill.id,
        userId: input.userId,
      }),
    ),
  );
}

describe("build-time mission facts and selection against the real database", () => {
  it("anchors the new-lesson mission to every planned new lesson", async () => {
    const input = await fixture();
    const lessons = await Promise.all([libraryLessonFixture(), libraryLessonFixture()]);
    const blocks = lessons.map((lesson) => ({ ...block("learn"), lessonId: lesson.id }));
    const facts = await load(input, blocks);

    expect(
      facts.candidates.find((pick) => pick.kind === "somethingNew")?.anchor.lessonIds,
    ).toStrictEqual(lessons.map((lesson) => lesson.id));
  });

  it("finishes a chapter only when every remaining lesson fits today", async () => {
    const input = await fixture();
    const chapter = await libraryChapterFixture();
    const lessons = await Promise.all([libraryLessonFixture(), libraryLessonFixture()]);

    const items = await Promise.all(
      lessons.map((lesson, index) =>
        planItemFixture({
          chapterId: chapter.id,
          lessonId: lesson.id,
          planId: input.plan.id,
          position: index + 1,
          skillId: input.skill.id,
        }),
      ),
    );

    const blocks = items.map((item) => ({
      ...block("learn", toBlockPayload({ chapterId: chapter.id, planItemId: item.id })),
      lessonId: item.lessonId,
    }));

    const facts = await load(input, blocks);

    expect(pickMissions(facts).find((pick) => pick.kind === "finishChapter")).toMatchObject({
      total: 2,
    });

    const partial = await load(input, blocks.slice(0, 1));
    expect(partial.candidates.some((pick) => pick.kind === "finishChapter")).toBe(false);
  });

  it.each([
    ["boss", false, "challenge"],
    ["weekly", true, "mock"],
    ["weekly", false, "weeklyChallenge"],
  ] as [BlockCheckpoint["kind"], boolean, string][])(
    "gives the planned %s work priority",
    async (kind, mock, expected) => {
      const input = await fixture();

      await prisma.subscription.create({
        data: { plan: "plus", referenceId: input.userId, status: "active" },
      });

      const facts = await load(input, [
        block("review"),
        block("learn"),
        block("produce"),
        block(
          "checkpoint",
          toBlockPayload({
            checkpoint: {
              kind,
              mock,
              passMark: 1,
              phase: null,
              rematch: false,
              timeLimitMinutes: null,
            },
          }),
        ),
      ]);

      expect(pickMissions(facts).map((pick) => pick.kind)).toStrictEqual([
        "review",
        "somethingNew",
        expected,
      ]);
    },
  );

  it("uses a new learner's first step before a pile of ready mistakes", async () => {
    const input = await fixture();
    await mistakeFixture({ fixedAt: now, status: "fixed", userId: input.userId });
    await mistakes(input, 5);

    const facts = await load(input, [
      { ...block("review"), estimatedMinutes: 8 },
      { ...block("learn"), estimatedMinutes: 8 },
    ]);

    expect(pickMissions(facts).at(-1)).toMatchObject({
      firstStep: true,
      kind: "askBuddy",
      total: 1,
    });
  });

  it("scales ready fixes to three only on roomy days and excludes ordinary practice", async () => {
    const input = await fixture();
    await experienced(input);
    await mistakes(input, 5);
    const planned = [block("review"), block("learn"), block("practice")];
    const roomy = await load(input, planned);
    expect(pickMissions(roomy).at(-1)).toMatchObject({ kind: "fixMistake", total: 3 });
    const short = await load(input, [block("review"), block("practice")], 14);
    expect(pickMissions(short).map((pick) => pick.kind)).toStrictEqual(["review", "practice"]);
    const medium = await load(input, planned, 20);
    expect(pickMissions(medium).at(-1)).toMatchObject({ kind: "fixMistake", total: 1 });
  });

  it("does not offer an old mistake with no drill material", async () => {
    const input = await fixture();
    await mistakeFixture({ createdAt: earlierDate, skillId: input.skill.id, userId: input.userId });
    const facts = await load(input, [block("review")]);
    expect(facts.readyMistakeCount).toBe(0);
    expect(facts.candidates.some((pick) => pick.kind === "fixMistake")).toBe(false);
  });

  it("rotates away from a kind offered most recently on this goal", async () => {
    const input = await fixture();

    await studySessionFixture({
      goalId: input.goal.id,
      localDate: earlierDate,
      missions: { picks: [{ anchor: {}, kind: "practice", total: 1 }], version: 1 },
      userId: input.userId,
    });

    const facts = await load(input, [block("review"), block("learn"), block("practice")]);
    facts.firstSteps = null;
    expect(facts.recentPicks).toStrictEqual([["practice"]]);
    expect(pickMissions(facts).at(-1)?.kind).toBe("askBuddy");
  });

  it("checks buddy quotas without claiming usage", async () => {
    const input = await fixture();

    await usageRecordsFixture({
      count: 10,
      createdAt: now,
      kind: "tutorMessage",
      userId: input.userId,
    });

    const facts = await load(input, [block("review")]);
    expect(facts.candidates.some((pick) => pick.kind === "askBuddy")).toBe(false);
    await expect(prisma.usageRecord.count({ where: { userId: input.userId } })).resolves.toBe(10);
  });

  it("never offers a Plus mock to a free learner", async () => {
    const input = await fixture();

    const facts = await load(input, [
      block(
        "checkpoint",
        toBlockPayload({
          checkpoint: {
            kind: "weekly",
            mock: true,
            passMark: 1,
            phase: null,
            rematch: false,
            timeLimitMinutes: null,
          },
        }),
      ),
    ]);

    expect(facts.candidates.some((pick) => pick.kind === "mock")).toBe(false);
  });

  it("offers no missions on a rest day even if a prior queue has blocks", async () => {
    const input = await fixture();

    await prisma.plan.update({
      data: { settings: { weekdayMinutes: [0, 0, 0, 0, 0, 0, 0] } },
      where: { id: input.plan.id },
    });

    const facts = await load(input, [block("review")]);
    expect(pickMissions(facts)).toStrictEqual([]);
    expect(facts.firstSteps).not.toBeNull();
  });

  it("keeps the first-steps list after the daily study-time limit while offering no missions", async () => {
    const input = await fixture();

    await Promise.all([
      learningProfileFixture({ dailyLimitMinutes: 10, userId: input.userId }),
      prisma.dailyProgress.create({
        data: { date: localDate, dayOfWeek: 2, timeSpentSeconds: 600, userId: input.userId },
      }),
    ]);

    const facts = await load(input, [block("review")]);
    expect(pickMissions(facts)).toStrictEqual([]);
    expect(facts.firstSteps).not.toBeNull();
  });
});
