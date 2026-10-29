import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { lockPlanSourceWrite, writePlanInputs } from "../library/_utils/plan-input-write";
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
