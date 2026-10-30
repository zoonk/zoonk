import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { answerPlacementQuestion } from "../learner/placement/answer-placement-question";
import { finishGoalPlacement } from "../learner/placement/finish-goal-placement";
import { lockPlanSourceWrite, writePlanInputs } from "../library/_utils/plan-input-write";
import { replanWaitingGoal } from "../library/curriculum/replan-waiting-goals";
import { generatedProvenance } from "../library/items/_test-utils/generated-items";
import { createLibraryLesson } from "../library/lessons/create-library-lesson";
import { createGoalPlan } from "../plans/create-goal-plan";
import { isPlanConflictError } from "../plans/plan-conflict";
import { sessionGoalFixture } from "../sessions/_test-utils/session-goal";
import { openStudyDay } from "../sessions/open-study-day";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";
import { type OnboardingAnswerInput } from "../view-models/onboarding/onboarding-contract";

const ANSWERS: OnboardingAnswerInput[] = [
  { dailyMinutes: 25, question: "schedule" },
  { level: "basic", question: "level" },
  { question: "targetDate", targetDate: "2027-04-29" },
];

async function duringPublications<T>(lessonId: string, run: () => Promise<T>): Promise<T> {
  const finished = { value: false };
  const saving = run();

  const answer = Promise.allSettled([saving]).then(() => {
    finished.value = true;
  });

  let publications = 0;

  async function publish(): Promise<void> {
    if (finished.value) {
      return;
    }

    await writePlanInputs(async (tx) => {
      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

      await tx.lesson.update({
        data: { estimatedMinutes: 3 + (publications % 2) },
        where: { id: lessonId },
      });
    });

    publications += 1;
    return publish();
  }

  await Promise.all([answer, publish()]);
  expect(publications).toBeGreaterThan(1);
  return saving;
}

describe.each([true, false])("content publication bursts (guest: %s)", (isAnonymous) => {
  it.each(ANSWERS)("saves the learner's $question answer", async (input) => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous }, where: { id: user.id } });
    const { goal, lessons } = await sessionGoalFixture({ userId: user.id });
    mockAccountSession({ isAnonymous, user });

    if (!isAnonymous) {
      const opened = await openStudyDay({
        goalId: goal.id,
        shownDate: new Date().toISOString().slice(0, 10),
        timeZone: "UTC",
      });

      if (opened.status !== "opened") {
        throw new Error(`Could not open Today: ${opened.status}`);
      }
    }

    const saving = duringPublications(lessons[0]!.id, () =>
      answerOnboardingQuestion({ goalId: goal.id, input }),
    );

    await expect(saving).resolves.toMatchObject({ status: "saved" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      ...(input.question === "schedule" && { dailyMinutes: input.dailyMinutes }),
      details: { answered: [input.question] },
    });
  });

  it("opens Today during the burst instead of returning retryable", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous }, where: { id: user.id } });
    const { goal, lessons } = await sessionGoalFixture({ userId: user.id });
    mockAccountSession({ isAnonymous, user });

    await expect(
      duringPublications(lessons[0]!.id, () =>
        openStudyDay({
          goalId: goal.id,
          shownDate: new Date().toISOString().slice(0, 10),
          timeZone: "UTC",
        }),
      ),
    ).resolves.toMatchObject({ status: "opened" });
  });
});

async function duringReplans<T>(
  goalId: string,
  lessonId: string,
  run: () => Promise<T>,
): Promise<T> {
  await replanWaitingGoal(goalId);
  const { skillId } = await prisma.lessonSkill.findFirstOrThrow({ where: { lessonId } });
  const finished = { value: false };
  let refreshes = 0;
  const saving = run();

  const answer = Promise.allSettled([saving]).then(() => {
    finished.value = true;
  });

  async function refresh(): Promise<void> {
    if (finished.value) {
      return;
    }

    await createLibraryLesson({
      description: "A lesson from the next outline band",
      estimatedMinutes: 4,
      homeChapterId: null,
      identityKey: `test-lesson-${randomUUID()}`,
      language: "en",
      level: "beginner",
      ownerId: null,
      provenance: generatedProvenance(),
      skillIds: [skillId],
      targetLanguage: null,
      title: `Next lesson ${randomUUID()}`,
    });

    try {
      await replanWaitingGoal(goalId);
    } catch (error) {
      if (!isPlanConflictError(error)) {
        throw error;
      }
    }

    refreshes += 1;
    return refresh();
  }

  await Promise.all([answer, ...Array.from({ length: 3 }, () => refresh())]);
  expect(refreshes).toBeGreaterThan(1);
  return saving;
}

describe.each([true, false])("background re-plan bursts (guest: %s)", (isAnonymous) => {
  it("saves the schedule while outline bands re-plan", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous }, where: { id: user.id } });
    const { goal, lessons, skills } = await sessionGoalFixture({ lessons: 3, userId: user.id });
    mockAccountSession({ isAnonymous, user });

    await prisma.goal.update({
      data: {
        details: {
          answered: ["purpose", "level", "targetDate", "buddy", "placement"],
          level: "basic",
        },
      },
      where: { id: goal.id },
    });

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: skills.map((skill) => ({
          area: null,
          lessons: 3,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    await expect(
      duringReplans(goal.id, lessons[0]!.id, () =>
        answerOnboardingQuestion({
          goalId: goal.id,
          input: { dailyMinutes: 25, question: "schedule" },
        }),
      ),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 25,
      details: { answered: expect.arrayContaining(["schedule", "placement"]) },
    });
  });

  it("builds the plan after placement while outline bands re-plan", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous }, where: { id: user.id } });

    const { goal, lessons, skills, items } = await sessionGoalFixture({
      lessons: 3,
      userId: user.id,
    });

    mockAccountSession({ isAnonymous, user });

    await prisma.goal.update({
      data: { details: { answered: ["purpose", "level", "targetDate", "buddy"], level: "basic" } },
      where: { id: goal.id },
    });

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: skills.map((skill) => ({
          area: null,
          lessons: 3,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    await Promise.all(
      items
        .filter((item) => item.skillId === skills[0]!.id)
        .map((item) =>
          answerPlacementQuestion({
            goalId: goal.id,
            input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: item.id },
          }),
        ),
    );

    await expect(
      duringReplans(goal.id, lessons[0]!.id, () =>
        finishGoalPlacement({ goalId: goal.id, input: {} }),
      ),
    ).resolves.toMatchObject({ completion: { knownSkillIds: [skills[0]!.id] }, status: "ready" });
  });
});
