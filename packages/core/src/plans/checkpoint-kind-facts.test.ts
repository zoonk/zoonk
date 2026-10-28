import { type GoalKind, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  listeningBlueprintFixture,
  listeningContent,
  listeningSetFixture,
} from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { estimateCoursePlan } from "../catalog/course-estimate";
import { getChallenge } from "../checkpoints/get-challenge";
import { startChallenge } from "../checkpoints/start-challenge";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { openTodayView } from "../sessions/_test-utils/open-today-view";
import { readBlockPayload } from "../sessions/block-payload";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { getLearningShare } from "./planner/plan-phases";
import { parsePlanPhases, parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

const START = "2020-09-28";
const NOW = new Date(`${START}T12:00:00Z`);
const DAYS = [1, 2, 3, 4, 5];

async function questionBank({ count, skillId }: { count: number; skillId: string }) {
  return Promise.all(
    Array.from({ length: count }, () => itemFixture({ content: choiceItemContent(), skillId })),
  );
}

async function recording({
  count,
  examBlueprintId,
  skillId,
  sourceId = null,
  voiced = true,
}: {
  count: number;
  examBlueprintId: string;
  skillId: string;
  sourceId?: string | null;
  voiced?: boolean;
}) {
  const media = voiced ? await mediaAssetFixture() : null;

  const set = await listeningSetFixture({
    content: listeningContent(),
    examBlueprintId,
    mediaAssetId: media?.id ?? null,
  });

  const items = await Promise.all(
    Array.from({ length: count }, (_, setPosition) =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId,
        setId: set.id,
        setPosition,
        skillId,
        sourceId,
      }),
    ),
  );

  return { items, set };
}

async function setup({
  kind = "learn",
  listening = false,
  phases = 1,
  questions = 6,
  voiced = true,
}: {
  kind?: GoalKind;
  listening?: boolean;
  phases?: number;
  questions?: number;
  voiced?: boolean;
} = {}) {
  const ordinaryAreas = ["Math", "Science"];
  const targetLanguage = kind === "language" ? "es" : null;

  const [user, library, blueprint] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      phases: Array.from({ length: phases }, (_, index) => `Unit ${index + 1}`),
      skills: Array.from({ length: phases }, (_, phase) => ({
        area: listening ? "Listening" : ordinaryAreas[phase],
        lessons: 12,
        phase,
      })),
    }),
    listening
      ? listeningBlueprintFixture({ name: `Boss recordings ${crypto.randomUUID()}` })
      : null,
  ]);

  const banks = await Promise.all(
    library.skills.map((skill, index) =>
      listening && blueprint
        ? recording({ count: questions, examBlueprintId: blueprint.id, skillId: skill.id, voiced })
        : questionBank({ count: index === 0 ? questions : 10, skillId: skill.id }),
    ),
  );

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: NOW,
    dailyMinutes: 60,
    details: { placementDeclined: true },
    examBlueprintId: blueprint?.id ?? null,
    kind: listening ? "exam" : kind,
    settings: { startDate: START, weekdayMinutes: [0, 60, 60, 60, 60, 60, 0] },
    targetLanguage: listening ? "en" : targetLanguage,
    timezone: "UTC",
    userId: user.id,
  });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  const bosses = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "boss", planId: plan.id },
  });

  expect(bosses).toHaveLength(phases);
  return { banks, blueprint, bosses, goal, library, plan, user };
}

async function planBossMinutes(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error(`Expected the real Plan: ${result.status}`);
  }

  return result.plan.week.days.flatMap((day) => day.items).filter((item) => item.kind === "boss");
}

async function onBossDay(fixture: Awaited<ReturnType<typeof setup>>, expectedMinutes: number) {
  const boss = fixture.bosses[0];

  if (!boss?.scheduledFor) {
    throw new Error("Expected the actual scheduled boss date");
  }

  await prisma.planItem.updateMany({
    data: { completedAt: NOW, status: "done" },
    where: { kind: "lesson", planId: fixture.plan.id },
  });

  vi.setSystemTime(new Date(boss.scheduledFor.getTime() + 43_200_000));
  const challenge = await getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

  expect
    .soft(challenge)
    .toMatchObject({ challenge: { estimatedMinutes: expectedMinutes }, status: "ready" });

  const today = await openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });

  if (today.status !== "ready") {
    throw new Error("Expected the real boss-day session");
  }

  const session = await prisma.studySession.findUniqueOrThrow({
    include: { blocks: true },
    where: { id: today.today.session.id },
  });

  const block = session.blocks.find((entry) => readBlockPayload(entry).planItemId === boss.id);
  expect(block?.estimatedMinutes).toBe(expectedMinutes);
  return { block, challenge, session };
}

describe("checkpoint kind facts share the actual planned and played duration", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("uses the actual six-question text boss's nine-minute reservation", async () => {
    const fixture = await setup();
    expect.soft(await planBossMinutes(fixture.goal.id)).toMatchObject([{ minutes: 9 }]);
    const { challenge } = await onBossDay(fixture, 9);
    expect(challenge).toMatchObject({ challenge: { questions: 6 } });
  });

  it("reserves eighteen minutes for a whole twelve-question recording without truncating it", async () => {
    const fixture = await setup({ listening: true, questions: 12 });
    expect.soft(await planBossMinutes(fixture.goal.id)).toMatchObject([{ minutes: 18 }]);
    const { block, challenge } = await onBossDay(fixture, 18);
    expect(challenge).toMatchObject({ challenge: { questions: 12 } });

    if (!block) {
      throw new Error("Expected the entire recording in the actual session");
    }

    const bank = fixture.banks[0];

    if (!bank || Array.isArray(bank)) {
      throw new Error("Expected the real recording fixture");
    }

    expect(readBlockPayload(block).itemIds).toStrictEqual(bank.items.map((item) => item.id));

    await expect(
      prisma.item.count({
        where: { id: { in: readBlockPayload(block).itemIds }, setId: bank.set.id },
      }),
    ).resolves.toBe(12);
  });

  it("uses the language call's six-minute block allocation rather than the question-boss size", async () => {
    const fixture = await setup({ kind: "language", questions: 0 });
    expect.soft(await planBossMinutes(fixture.goal.id)).toMatchObject([{ minutes: 6 }]);
    await onBossDay(fixture, 6);
  });

  it("retains an unvoiced listening boss as pending with no pretend playable minutes", async () => {
    const fixture = await setup({ listening: true, questions: 12, voiced: false });
    expect.soft(await planBossMinutes(fixture.goal.id)).toMatchObject([{ minutes: 0 }]);
    const boss = fixture.bosses[0];

    if (!boss?.scheduledFor) {
      throw new Error("Expected the pending boss date");
    }

    vi.setSystemTime(new Date(boss.scheduledFor.getTime() + 43_200_000));
    const result = await getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

    expect
      .soft(result)
      .toMatchObject({
        challenge: { estimatedMinutes: 0, questions: 0, status: "waiting" },
        status: "ready",
      });

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({ status: "notToday" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ kind: "boss", status: "todo" });
  });

  it("does not offer an unavailable future listening boss as a zero-question challenge", async () => {
    const fixture = await setup({ listening: true, questions: 12, voiced: false });
    const boss = fixture.bosses[0];

    if (!boss?.scheduledFor) {
      throw new Error("Expected the pending boss date");
    }

    expect(boss.scheduledFor.getTime()).toBeGreaterThan(NOW.getTime());

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({
      challenge: { estimatedMinutes: 0, questions: 0, status: "waiting" },
      status: "ready",
    });

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({ status: "notToday" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ kind: "boss", status: "todo" });
  });

  it("reloads the changed phase's bank facts without absorbing finer shared-lesson tags or changing the other phase", async () => {
    const fixture = await setup({ phases: 2 });
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
    const finer = await skillFixture();

    await Promise.all([
      lessonSkillFixture({ lessonId: fixture.library.lessons[0]?.id ?? "", skillId: finer.id }),
      questionBank({ count: 10, skillId: finer.id }),
    ]);

    const goalPlan = await loadGoalPlan(fixture.goal.id);

    expect(
      goalPlan.skills.find((skill) => skill.id === fixture.library.skills[0]?.id)?.memberSkillIds,
    ).toContain(finer.id);

    expect(goalPlan.skills.map((skill) => skill.id)).not.toContain(finer.id);

    expect
      .soft(await planBossMinutes(fixture.goal.id))
      .toMatchObject([{ minutes: 9 }, { minutes: 15 }]);

    await questionBank({ count: 4, skillId: fixture.library.skills[0]?.id ?? "" });
    await refreshGoalPlan({ goalId: fixture.goal.id, pace: "saved" });
    const after = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
    expect.soft(after.inputsKey).not.toBe(before.inputsKey);

    expect(after.version, "Changed real checkpoint minutes require the complete write").toBe(
      before.version + 1,
    );

    expect
      .soft(await planBossMinutes(fixture.goal.id))
      .toMatchObject([{ minutes: 15 }, { minutes: 15 }]);

    const held = await prisma.planItem.findMany({
      orderBy: { phase: "asc" },
      where: { kind: "boss", planId: fixture.plan.id },
    });

    expect(held.map((boss) => boss.id)).toStrictEqual(fixture.bosses.map((boss) => boss.id));
  });

  it("uses an unsigned public recording baseline, excluding private material and other learners' answers, and refreshes when that bank changes", async () => {
    const [course, library, blueprint, other] = await Promise.all([
      courseFixture({
        format: "exam",
        isPublished: true,
        outlineStatus: "completed",
        targetLanguage: "en",
        visibility: "public",
      }),
      planLibraryFixture({ skills: [{ area: "Listening", lessons: 12 }] }),
      listeningBlueprintFixture({ name: `Unsigned boss ${crypto.randomUUID()}` }),
      userFixture(),
    ]);

    const skillId = library.skills[0]?.id ?? "";

    await prisma.examBlueprint.update({
      data: { language: course.language },
      where: { id: blueprint.id },
    });

    const privateSource = await sourceFixture({ ownerId: other.id, visibility: "private" });

    await recording({
      count: 20,
      examBlueprintId: blueprint.id,
      skillId,
      sourceId: privateSource.id,
    });

    const first = await recording({ count: 12, examBlueprintId: blueprint.id, skillId });
    await recording({ count: 6, examBlueprintId: blueprint.id, skillId });

    await Promise.all([
      courseChapterFixture({
        area: "Listening",
        chapterId: library.chapters[0]?.id ?? "",
        courseId: course.id,
        position: 0,
      }),
      prisma.chapterSkill.create({ data: { chapterId: library.chapters[0]?.id ?? "", skillId } }),
      prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: NOW,
          graph: {
            ...library.graph,
            skills: library.graph.skills.map((skill) => ({ ...skill, courseIds: [course.id] })),
          },
          model: "fixture",
          primaryCourseId: course.id,
          promptVersion: "fixture",
          runId: "fixture",
        },
      }),
      ...first.items.map((item) =>
        attemptFixture({
          answeredAt: new Date("2020-09-27T12:00:00Z"),
          itemId: item.id,
          skillId,
          userId: other.id,
        }),
      ),
    ]);

    const input = { courseId: course.id, dailyMinutes: 60, studyDays: DAYS };
    mockSession(null);
    const before = await estimateCoursePlan(input);
    expect.soft(before).toMatchObject({ workload: { checkpointMinutes: 18 } });
    mockSession(other.id);
    await expect(estimateCoursePlan(input)).resolves.toStrictEqual(before);
    const courseBefore = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    vi.setSystemTime(new Date("2020-09-28T12:00:01Z"));

    await itemFixture({
      content: choiceItemContent(),
      examBlueprintId: blueprint.id,
      setId: first.set.id,
      setPosition: 12,
      skillId,
    });

    mockSession(null);
    const after = await estimateCoursePlan(input);
    expect.soft(after).toMatchObject({ workload: { checkpointMinutes: 20 } });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ updatedAt: courseBefore.updatedAt });
  });

  it.each([
    { bossMinutes: 18, voiced: true },
    { bossMinutes: 0, voiced: false },
  ])(
    "commits the initial listening reservation of $bossMinutes before any Plan-view recompute",
    async ({ bossMinutes, voiced }) => {
      const [user, library, blueprint] = await Promise.all([
        userFixture(),
        planLibraryFixture({ skills: [{ area: "Listening", lessons: 12 }] }),
        listeningBlueprintFixture({ name: `Initial listening ${crypto.randomUUID()}` }),
      ]);

      await recording({
        count: 12,
        examBlueprintId: blueprint.id,
        skillId: library.skills[0]?.id ?? "",
        voiced,
      });

      const { goal, plan } = await unplannedGoalFixture({
        createdAt: NOW,
        dailyMinutes: 60,
        details: { placementDeclined: true },
        examBlueprintId: blueprint.id,
        kind: "exam",
        settings: { startDate: START, weekdayMinutes: [0, 60, 60, 60, 60, 60, 0] },
        targetLanguage: "en",
        timezone: "UTC",
        userId: user.id,
      });

      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      });

      mockSession(user.id);

      await expect(
        createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" }),
      ).resolves.toMatchObject({ status: "created" });

      const initial = await prisma.plan.findUniqueOrThrow({
        include: { items: true },
        where: { id: plan.id },
      });

      const settings = parsePlanSettings(initial.settings);
      const share = getLearningShare({ phaseKind: "learn", practiceBias: settings.practiceBias });

      const lessonMinutes = library.lessons.reduce(
        (sum, lesson) => sum + (lesson.estimatedMinutes * (settings.pace?.factor ?? 1)) / share,
        0,
      );

      const expectedMinutes = Math.round(lessonMinutes + bossMinutes);

      expect(
        initial.items
          .filter((item) => item.kind === "lesson")
          .map((item) => item.lessonId)
          .toSorted((first, second) => String(first).localeCompare(String(second))),
      ).toStrictEqual(library.lessons.map((lesson) => lesson.id).toSorted());

      expect(initial.items.filter((item) => item.kind !== "lesson")).toMatchObject([
        { kind: "boss", status: "todo" },
      ]);

      expect.soft(initial.estimateHours).toBe(expectedMinutes / 60);

      expect
        .soft(parsePlanPhases(initial.phases).map((phase) => phase.minutes))
        .toStrictEqual([expectedMinutes]);

      expect(initial.setupTasks).toStrictEqual(expect.arrayContaining(["placement", "routine"]));
    },
  );

  it("excludes someone else's private audio from the signed-out public baseline and ignores a private blueprint's bank", async () => {
    const [course, library, blueprint, other] = await Promise.all([
      courseFixture({
        format: "exam",
        isPublished: true,
        outlineStatus: "completed",
        targetLanguage: "en",
        visibility: "public",
      }),
      planLibraryFixture({ skills: [{ area: "Listening", lessons: 12 }] }),
      listeningBlueprintFixture({ name: `Private audio boundary ${crypto.randomUUID()}` }),
      userFixture(),
    ]);

    await prisma.examBlueprint.update({
      data: { language: course.language },
      where: { id: blueprint.id },
    });

    const skillId = library.skills[0]?.id ?? "";
    const privateAudio = await recording({ count: 20, examBlueprintId: blueprint.id, skillId });

    await prisma.mediaAsset.update({
      data: { ownerId: other.id, visibility: "private" },
      where: { id: privateAudio.set.mediaAssetId ?? "" },
    });

    if (!blueprint.structure || typeof blueprint.structure !== "object") {
      throw new Error("Expected the persisted listening blueprint structure");
    }

    const privateBlueprint = await examBlueprintFixture({
      ownerId: other.id,
      structure: blueprint.structure,
      visibility: "private",
    });

    await recording({ count: 24, examBlueprintId: privateBlueprint.id, skillId });
    const publicAudio = await recording({ count: 12, examBlueprintId: blueprint.id, skillId });

    await Promise.all([
      courseChapterFixture({
        area: "Listening",
        chapterId: library.chapters[0]?.id ?? "",
        courseId: course.id,
        position: 0,
      }),
      prisma.chapterSkill.create({ data: { chapterId: library.chapters[0]?.id ?? "", skillId } }),
      prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: NOW,
          graph: {
            ...library.graph,
            skills: library.graph.skills.map((skill) => ({ ...skill, courseIds: [course.id] })),
          },
          model: "fixture",
          primaryCourseId: course.id,
          promptVersion: "fixture",
          runId: "fixture",
        },
      }),
    ]);

    expect(publicAudio.items).toHaveLength(12);
    const input = { courseId: course.id, dailyMinutes: 60, studyDays: DAYS };
    mockSession(null);

    expect
      .soft(await estimateCoursePlan(input))
      .toMatchObject({ workload: { checkpointMinutes: 18 } });

    await prisma.itemSet.update({
      data: { mediaAssetId: null },
      where: { id: privateAudio.set.id },
    });

    await expect(estimateCoursePlan(input)).resolves.toMatchObject({
      workload: { checkpointMinutes: 18 },
    });

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: privateAudio.set.mediaAssetId ?? "" } }),
    ).resolves.toMatchObject({ ownerId: other.id, visibility: "private" });
  });
});
