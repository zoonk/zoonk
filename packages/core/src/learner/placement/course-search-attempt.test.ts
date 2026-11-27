import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { lowGuessTapItems } from "../_test-utils/placement-tap-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

it("serves released Android's read-only onboarding and explicit Plan starts through completion and Undo", async () => {
  const user = await userFixture();
  const { goal, skills } = await learnerGoalFixture({
    userId: user.id,
    phases: [8],
    itemsPerSkill: 0,
  });
  const items = (await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)))).flat();
  mockSession(user.id);
  const goalId = goal.id;
  await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
    placement: { status: "unavailable", attempt: null, next: null },
  });
  const opened = await startPlacementSitting({ goalId, input: { length: "wholeCourse" } });
  if (opened.status !== "ready" || !opened.placement.attempt)
    throw new Error("Expected a course start");
  const { id } = opened.placement.attempt;
  expect(opened.placement.attempt).toMatchObject({
    length: "quick",
    part: 1,
    partComplete: false,
    estimatedMinutes: 4,
    questions: 8,
  });
  let placement = opened.placement;
  while (placement.next) {
    const tap = items.find(({ item }) => item.id === placement.next?.itemId);
    if (!tap) throw new Error("Expected a banked item");
    const request = {
      goalId,
      input: { answer: tap.answer, attemptId: id, durationMs: 1000, itemId: tap.item.id, part: 1 },
    };
    const saved = await answerPlacementQuestion(request);
    if (saved.status !== "ready") throw new Error("Expected the frozen question to be answered");
    expect(saved.placement.answered).toBe(placement.answered + 1);
    await expect(answerPlacementQuestion(request)).resolves.toMatchObject({
      status: "ready",
      placement: { answered: saved.placement.answered },
    });
    placement = saved.placement;
    expect(placement.answered).toBeLessThanOrEqual(8);
  }
  expect(placement).toMatchObject({ status: "done", attempt: { id }, result: null });
  const result = await finishGoalPlacement({ goalId, input: { attemptId: id, part: 1 } });
  if (result.status !== "ready" || !result.completion.result) throw new Error("Expected a result");
  expect(result.completion.changeId).toBeTruthy();
  const skipped = result.completion.lessonsSkipped;
  expect(skipped).toBeGreaterThan(0);
  expect(result.completion.result).toMatchObject({
    lessonsSkipped: skipped,
    course: { lessons: 8, chapters: [{ lessons: 8, skipped, start: true }] },
    nextLesson: { estimatedMinutes: expect.any(Number), title: expect.any(String) },
  });
  expect(await prisma.learnerSkill.count({ where: { userId: user.id } })).toBe(0);
});
