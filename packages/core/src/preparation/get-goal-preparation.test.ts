import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { markSkillsKnown } from "../learner/_utils/known-skills";
import { answerPlacementQuestion } from "../learner/placement/answer-placement-question";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { measureSessionState } from "../sessions/_utils/capture-snapshot";
import { getGoalPreparation } from "./get-goal-preparation";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

const NOW = new Date();
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

function mockClock(now = NOW) {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    currentInstant: now,
    timeZone: "UTC",
  });
}

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 3, phases: [2, 2], userId: user.id });
  mockSession(user.id);
  mockClock();

  return { ...fixture, user };
}

describe(getGoalPreparation, () => {
  it("requires a signed-in learner and hides other learners' goals", async () => {
    const { goal } = await setup();

    mockSession(null);
    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);
    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("starts at zero, with no estimated score before a mock", async () => {
    const { goal } = await setup();

    const result = await getGoalPreparation(goal.id);

    expect(result.status === "ready" && result.preparation).toMatchObject({
      estimatedScore: null,
      skills: { new: 4, total: 4 },
      stage: "starting",
      status: null,
      value: 0,
      weakestAreaId: null,
    });
  });

  it("measures the week's gain from Monday in the learner's time zone, so a Monday starts at zero", async () => {
    const { goal, skills, user } = await setup();
    const saturday = new Date("2026-10-03T15:00:00Z");
    // Monday 12:00 in São Paulo: the week began there at Monday 00:00 (03:00 UTC).
    const monday = new Date("2026-10-05T15:00:00Z");

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2026-10-05T00:00:00Z"),
      currentInstant: monday,
      timeZone: "UTC",
    });

    const studied = (skillId: string, at: Date) =>
      Promise.all([
        learnerSkillFixture({
          createdAt: at,
          difficulty: 5,
          lastReviewedAt: at,
          recallDays: 1,
          reps: 2,
          skillId,
          stability: 10,
          state: "learning",
          userId: user.id,
        }),
        attemptFixture({ answeredAt: at, skillId, userId: user.id }),
      ]);

    await Promise.all([
      prisma.goal.update({ data: { timezone: "America/Sao_Paulo" }, where: { id: goal.id } }),
      studied(skills[0]?.id ?? "", saturday),
    ]);

    const lastWeekOnly = await getGoalPreparation(goal.id);

    expect(lastWeekOnly.status === "ready" && lastWeekOnly.preparation.value).toBeGreaterThan(0);
    expect(lastWeekOnly.status === "ready" && lastWeekOnly.preparation.weekGain).toBe(0);

    await studied(skills[1]?.id ?? "", new Date("2026-10-05T12:00:00Z"));

    const withMonday = await getGoalPreparation(goal.id);

    expect(withMonday.status === "ready" && withMonday.preparation.weekGain).toBeGreaterThan(0);
  });

  it("measures studied skills, unseen questions and an exam's mocks by area", async () => {
    const { chapters, goal, items, skills, user } = await setup();

    await Promise.all([
      prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
      learnerSkillFixture({
        createdAt: daysAgo(10),
        difficulty: 5,
        lastReviewedAt: daysAgo(1),
        recallDays: 1,
        reps: 3,
        skillId: skills[0]?.id ?? "",
        stability: 10,
        state: "solid",
        userId: user.id,
      }),
      learnerSkillFixture({
        createdAt: daysAgo(2),
        difficulty: 5,
        lastReviewedAt: daysAgo(2),
        reps: 1,
        skillId: skills[1]?.id ?? "",
        stability: 2,
        state: "learning",
        userId: user.id,
      }),
      // Skill 2's answers came in a lesson: a step, not one of the bank's questions.
      attemptFixture({ answeredAt: daysAgo(2), skillId: skills[1]?.id ?? "", userId: user.id }),
      ...items
        .slice(0, 6)
        .map((item, index) =>
          attemptFixture({
            answeredAt: daysAgo(index + 1),
            isCorrect: index !== 5,
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
      learningEventFixture({
        correctAnswers: 27,
        endedAt: daysAgo(3),
        goalId: goal.id,
        incorrectAnswers: 18,
        kind: "mock",
        userId: user.id,
      }),
    ]);

    const result = await getGoalPreparation(goal.id);
    const preparation = result.status === "ready" ? result.preparation : null;

    expect(preparation?.components.coverage).toMatchObject({
      studiedSkills: 2,
      totalSkills: 4,
      value: 0.5,
    });

    expect(preparation?.components.mastery).toMatchObject({ answered: 6, correct: 5 });

    expect(preparation?.components.mocks).toStrictEqual({
      kind: "mockExams",
      plusRequired: false,
      taken: 1,
      value: 0.6,
    });

    expect(preparation?.estimatedScore).toMatchObject({ mocks: 1, scale: "percent" });
    expect(preparation?.value).toBeGreaterThan(0);
    expect(preparation?.value).toBeLessThan(0.5);

    expect(
      preparation?.areas.map((area) => [area.areaId, area.title, area.skills.total]),
    ).toStrictEqual([
      [chapters[0]?.id, "Chapter 1", 2],
      [chapters[1]?.id, "Chapter 2", 2],
    ]);

    expect(preparation?.weakestAreaId).toBe(chapters[0]?.id);
  });

  it("counts hard skills more, and the session summary reads the same number", async () => {
    const { goal, items, skills, user } = await setup();
    const ids = skills.map((skill) => skill.id);
    const easy = new Set(ids.slice(0, 2));

    // The first two skills' questions are easy for every learner, the last two's hard.
    await Promise.all([
      prisma.item.updateMany({
        data: { difficulty: -1 },
        where: { skillId: { in: ids.slice(0, 2) } },
      }),
      prisma.item.updateMany({ data: { difficulty: 1 }, where: { skillId: { in: ids.slice(2) } } }),
    ]);

    // Every easy question right, the hard ones never tried.
    await Promise.all(
      items
        .filter((item) => easy.has(item.skillId))
        .map((item, index) =>
          attemptFixture({
            answeredAt: daysAgo(index + 1),
            isCorrect: true,
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
    );

    const result = await getGoalPreparation(goal.id);
    const preparation = result.status === "ready" ? result.preparation : null;

    // Half the skills, a quarter of what the goal asks: an easy skill counts half, a hard one 1.5.
    expect(preparation?.components.coverage).toStrictEqual({
      heaviest: { studiedSkills: 0, totalSkills: 2, value: 0 },
      studiedSkills: 2,
      totalSkills: 4,
      value: 0.25,
    });

    expect(preparation?.stage).not.toBe("solid");

    const session = await measureSessionState({
      goalId: goal.id,
      now: NOW,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(session.preparation).toBe(preparation?.value);
  });

  it("counts what the learner showed, never what they only said they know", async () => {
    const { goal, skills, user } = await setup();
    const [first, second] = skills;

    // Ticking a subject or a stated level skips lessons: placement assumes those skills known.
    await markSkillsKnown({
      knownAt: daysAgo(1),
      skillIds: [first?.id ?? "", second?.id ?? ""],
      timeZone: "UTC",
      userId: user.id,
    });

    const assumed = await getGoalPreparation(goal.id);
    const assumedPreparation = assumed.status === "ready" ? assumed.preparation : null;

    expect(assumedPreparation?.value).toBe(0);
    expect(assumedPreparation?.components.coverage).toMatchObject({ studiedSkills: 0 });
    expect(assumedPreparation?.components.retention.value).toBeNull();
    expect(assumedPreparation?.skills.fading).toBe(0);

    await attemptFixture({ answeredAt: NOW, skillId: first?.id ?? "", userId: user.id });

    const shown = await getGoalPreparation(goal.id);

    expect(shown.status === "ready" && shown.preparation.components.coverage).toMatchObject({
      studiedSkills: 1,
      totalSkills: 4,
    });

    expect(shown.status === "ready" && shown.preparation.value).toBeGreaterThan(0);
  });

  it("never counts 'I don't know yet' as studying a skill", async () => {
    const { goal, items, skills } = await setup();
    const itemOf = (index: number) => items.find((item) => item.skillId === skills[index]?.id);

    // A focus test or placement answered "I don't know yet" on three skills: evidence of not knowing.
    await Promise.all(
      [0, 1, 2].map((index) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: { dontKnow: true }, durationMs: 4000, itemId: itemOf(index)?.id ?? "" },
        }),
      ),
    );

    // Answers are recorded at the real time, after the fixed clock's NOW.
    mockClock(new Date());

    const unknown = await getGoalPreparation(goal.id);
    const unknownPreparation = unknown.status === "ready" ? unknown.preparation : null;

    expect(unknownPreparation?.value).toBe(0);
    expect(unknownPreparation?.components.coverage).toMatchObject({ studiedSkills: 0 });

    await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 4000, itemId: itemOf(3)?.id ?? "" },
    });

    mockClock(new Date());

    const shown = await getGoalPreparation(goal.id);

    expect(shown.status === "ready" && shown.preparation.components.coverage).toMatchObject({
      studiedSkills: 1,
      totalSkills: 4,
    });
  });

  // Pedro's "Seu preparo" read "Cobertura 100% · 8 de 8 habilidades": placement's miss on osmosis
  // counted as studying it, and so did the one right answer that let his plan leave Núcleo out.
  it("never counts a missed test answer, nor the test answer a skill left out of the plan rests on", async () => {
    const { goal, items, plan, skills, user } = await setup();
    const leftOut = await skillFixture({ name: "Left out for now" });
    const leftOutItem = await itemFixture({ skillId: leftOut.id });

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ name: "Phase 1" }, { name: "Phase 2" }],
          skills: [...skills, leftOut].map((skill, index) => ({
            lessons: 3,
            name: skill.name,
            phase: index < 2 ? 0 : 1,
            skillId: skill.id,
          })),
        },
      },
      where: { id: plan.id },
    });

    const missed = items.find((item) => item.skillId === skills[0]?.id);

    await Promise.all([
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { selectedIndex: 1 }, durationMs: 4000, itemId: missed?.id ?? "" },
      }),
      attemptFixture({ itemId: leftOutItem.id, skillId: leftOut.id, userId: user.id }),
    ]);

    mockClock(new Date());

    const placed = await getGoalPreparation(goal.id);

    expect(placed.status === "ready" && placed.preparation.components.coverage).toMatchObject({
      studiedSkills: 0,
      totalSkills: 5,
    });

    // The full review the day before asks every topic: a right answer there is studying it.
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    await attemptFixture({
      itemId: leftOutItem.id,
      skillId: leftOut.id,
      studySessionId: session.id,
      userId: user.id,
    });

    mockClock(new Date());

    const reviewed = await getGoalPreparation(goal.id);

    expect(reviewed.status === "ready" && reviewed.preparation.components.coverage).toMatchObject({
      studiedSkills: 1,
      totalSkills: 5,
    });
  });

  it("counts a lesson's answers for the plan skill the lesson teaches", async () => {
    const { goal, planItems, user } = await setup();
    const [lesson, lessonSkill] = await Promise.all([libraryLessonFixture(), skillFixture()]);

    // The plan item teaches its skill with a Library lesson whose own skill is a finer one.
    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: lessonSkill.id }),
      prisma.planItem.update({
        data: { lessonId: lesson.id, status: "done" },
        where: { id: planItems[0]?.id ?? "" },
      }),
    ]);

    await Promise.all([
      learnerSkillFixture({
        createdAt: NOW,
        difficulty: 5,
        lastReviewedAt: NOW,
        recallDays: 1,
        reps: 1,
        skillId: lessonSkill.id,
        stability: 3,
        state: "learning",
        userId: user.id,
      }),
      attemptFixture({ answeredAt: NOW, skillId: lessonSkill.id, userId: user.id }),
    ]);

    const result = await getGoalPreparation(goal.id);
    const preparation = result.status === "ready" ? result.preparation : null;

    expect(preparation?.components.coverage).toMatchObject({
      studiedSkills: 1,
      totalSkills: 4,
      value: 0.25,
    });

    expect(preparation?.components.retention.value).toBeGreaterThan(0.9);
  });

  it("measures the whole goal, so the plan taking in a skill it had left out never lowers it", async () => {
    const { goal, plan, skills, user } = await setup();
    const leftOut = await skillFixture({ name: "Left out for now" });

    // A right answer: the attempt and the memory it built.
    const answer = (skillId: string, at: Date) =>
      Promise.all([
        attemptFixture({ answeredAt: at, skillId, userId: user.id }),
        learnerSkillFixture({
          createdAt: at,
          difficulty: 5,
          lastReviewedAt: at,
          recallDays: 1,
          reps: 1,
          skillId,
          stability: 3,
          state: "learning",
          userId: user.id,
        }),
      ]);

    // The goal's skill graph has a fifth skill the plan has no time for yet.
    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ name: "Phase 1" }, { name: "Phase 2" }],
          skills: [...skills, leftOut].map((skill, index) => ({
            lessons: 3,
            name: skill.name,
            phase: index < 2 ? 0 : 1,
            skillId: skill.id,
          })),
        },
      },
      where: { id: plan.id },
    });

    await answer(skills[0]?.id ?? "", daysAgo(1));

    const before = await getGoalPreparation(goal.id);

    expect(before.status === "ready" && before.preparation.components.coverage).toMatchObject({
      studiedSkills: 1,
      totalSkills: 5,
    });

    // More time: the plan takes the left-out skill in.
    await planItemFixture({ phase: 1, planId: plan.id, position: 10, skillId: leftOut.id });

    const after = await getGoalPreparation(goal.id);

    expect(after.status === "ready" && after.preparation.value).toBe(
      before.status === "ready" ? before.preparation.value : null,
    );

    // Studying the next skill correctly only adds to it.
    await answer(skills[1]?.id ?? "", NOW);

    const studied = await getGoalPreparation(goal.id);

    expect(studied.status === "ready" && studied.preparation.value).toBeGreaterThan(
      after.status === "ready" ? after.preparation.value : 1,
    );
  });

  it("tests other goals with their weekly challenges, with no score estimate", async () => {
    const { goal, user } = await setup();

    await Promise.all([
      learningEventFixture({
        correctAnswers: 8,
        endedAt: daysAgo(2),
        goalId: goal.id,
        incorrectAnswers: 2,
        kind: "checkpoint",
        lessonKind: "weeklyChallenge",
        userId: user.id,
      }),
      // A boss is a phase's checkpoint, not the week's test.
      learningEventFixture({
        correctAnswers: 1,
        endedAt: daysAgo(1),
        goalId: goal.id,
        incorrectAnswers: 9,
        kind: "checkpoint",
        lessonKind: "boss",
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 0,
        endedAt: daysAgo(1),
        goalId: goal.id,
        incorrectAnswers: 10,
        kind: "mock",
        userId: user.id,
      }),
    ]);

    const result = await getGoalPreparation(goal.id);
    const preparation = result.status === "ready" ? result.preparation : null;

    expect(preparation?.components.mocks).toStrictEqual({
      kind: "weeklyChallenges",
      plusRequired: false,
      taken: 1,
      value: 0.8,
    });

    expect(preparation?.estimatedScore).toBeNull();
  });

  // Pedro (free) was held under 75% "until a mock exam", which his plan doesn't include.
  it("counts a full review in the exam's format as the test of a learner whose plan has no mocks", async () => {
    const { goal, user } = await setup();

    await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });

    const before = await getGoalPreparation(goal.id);

    expect(before.status === "ready" && before.preparation.components.mocks).toStrictEqual({
      kind: "fullReviews",
      plusRequired: false,
      taken: 0,
      value: null,
    });

    await Promise.all([
      learningEventFixture({
        correctAnswers: 16,
        endedAt: daysAgo(1),
        goalId: goal.id,
        incorrectAnswers: 4,
        kind: "questions",
        lessonKind: "fullReview",
        userId: user.id,
      }),
      // Everyday practice isn't a test in real conditions.
      learningEventFixture({
        correctAnswers: 5,
        endedAt: daysAgo(2),
        goalId: goal.id,
        incorrectAnswers: 5,
        kind: "questions",
        lessonKind: "practice",
        userId: user.id,
      }),
    ]);

    const result = await getGoalPreparation(goal.id);
    const preparation = result.status === "ready" ? result.preparation : null;

    expect(preparation?.components.mocks).toStrictEqual({
      kind: "fullReviews",
      plusRequired: false,
      taken: 1,
      value: 0.8,
    });

    // A full review is no mock: there's still no estimated score.
    expect(preparation?.estimatedScore).toBeNull();
  });

  it("marks the mock exam as Plus once a free exam plan's first days are over", async () => {
    const { goal } = await setup();

    await prisma.goal.update({
      data: { createdAt: daysAgo(10), kind: "exam" },
      where: { id: goal.id },
    });

    const result = await getGoalPreparation(goal.id);

    expect(result.status === "ready" && result.preparation.components.mocks).toStrictEqual({
      kind: "mockExams",
      plusRequired: true,
      taken: 0,
      value: null,
    });
  });

  it("has no preparation for a quick explanation", async () => {
    const { goal } = await setup();
    await prisma.goal.update({ data: { kind: "explain" }, where: { id: goal.id } });

    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("reports the plan status from scheduled items", async () => {
    const { goal, planItems } = await setup();
    const today = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()));

    await Promise.all(
      planItems.map((item, index) =>
        prisma.planItem.update({
          data: {
            scheduledFor: new Date(today.getTime() + (index - 2) * DAY_MS),
            status: index < 3 ? "done" : "todo",
          },
          where: { id: item.id },
        }),
      ),
    );

    const result = await getGoalPreparation(goal.id);

    expect(result.status === "ready" && result.preparation.status).toStrictEqual({
      kind: "onTrack",
    });
  });
});
