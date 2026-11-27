import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  UNIT_PLAN_SELECT,
  loadCertificateUnits,
} from "../../certificates/_utils/load-certificate-units";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { lowGuessTapItems } from "../_test-utils/placement-tap-items";
import { loadClaimEvents } from "../_utils/load-skill-claims";
import { readSkillClaims } from "../_utils/skill-claims";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

test("serves released Android's read-only onboarding and explicit Plan starts through completion and Undo", async () => {
  const user = await userFixture();

  const { goal, skills } = await learnerGoalFixture({
    itemsPerSkill: 0,
    phases: [8],
    userId: user.id,
  });

  const items = (await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)))).flat();
  mockSession(user.id);
  const goalId = goal.id;

  await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
    placement: { attempt: null, next: null, status: "unavailable" },
  });

  const opened = await startPlacementSitting({ goalId, input: { length: "wholeCourse" } });

  if (opened.status !== "ready" || !opened.placement.attempt)
    {throw new Error("Expected a course start");}
  const { id } = opened.placement.attempt;

  expect(opened.placement.attempt).toMatchObject({
    estimatedMinutes: 4,
    length: "quick",
    part: 1,
    partComplete: false,
    questions: 8,
  });

  let placement = opened.placement;

  while (placement.next) {
    const tap = items.find(({ item }) => item.id === placement.next?.itemId);
    if (!tap) {throw new Error("Expected a banked item");}
    const request = {
      goalId,
      input: { answer: tap.answer, attemptId: id, durationMs: 1000, itemId: tap.item.id, part: 1 },
    };

    const saved = await answerPlacementQuestion(request);
    if (saved.status !== "ready") {throw new Error("Expected the frozen question to be answered");}
    expect(saved.placement.answered).toBe(placement.answered + 1);

    await expect(answerPlacementQuestion(request)).resolves.toMatchObject({
      placement: { answered: saved.placement.answered },
      status: "ready",
    });

    placement = saved.placement;
    expect(placement.answered).toBeLessThanOrEqual(8);
  }

  expect(placement).toMatchObject({ attempt: { id }, result: null, status: "done" });
  const result = await finishGoalPlacement({ goalId, input: { attemptId: id, part: 1 } });
  if (result.status !== "ready" || !result.completion.result) {throw new Error("Expected a result");}
  expect(result.completion.changeId).toBeTruthy();
  const skipped = result.completion.lessonsSkipped;
  expect(skipped).toBeGreaterThan(0);

  expect(result.completion.result).toMatchObject({
    course: { chapters: [{ lessons: 8, skipped, start: true }], lessons: 8 },
    lessonsSkipped: skipped,
    nextLesson: { estimatedMinutes: expect.any(Number), title: expect.any(String) },
  });

  const events = await loadClaimEvents({
    goalId,
    skillIds: skills.map((skill) => skill.id),
    userId: user.id,
  });

  expect(events.filter((e) => e.kind === "passedOver")).toHaveLength(skipped);
  expect(events.filter((e) => e.kind === "claim")).toHaveLength(0);

  expect([...readSkillClaims(events).values()]).toEqual(
    Array.from({ length: skipped }, () => "toConfirm"),
  );

  const plan = await prisma.plan.findUniqueOrThrow({ select: UNIT_PLAN_SELECT, where: { goalId } });

  const allElseFinished = {
    ...plan,
    items: plan.items.map((item) =>
      item.status === "testedOut"
        ? item
        : { ...item, completedAt: new Date(), status: "done" as const },
    ),
  };

  const cert = await loadCertificateUnits({ goal, plan: allElseFinished });
  expect(cert.units.length).toBeGreaterThan(0);
  expect(cert.units.every((unit) => !unit.finished)).toBe(true);

  const undo = await decidePlanChange({
    changeId: result.completion.changeId!,
    goalId,
    input: { status: "undone" },
  });

  expect(undo.status).toBe("updated");
  await expect(prisma.planItem.count({ where: { plan: { goalId }, status: "testedOut" } })).resolves.toBe(0);

  await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
    placement: {
      result: {
        changeId: null,
        course: { chapters: [{ skipped: 0, start: true }] },
        lessonsSkipped: 0,
      },
    },
  });

  expect(await prisma.learnerSkill.count({ where: { userId: user.id } })).toBe(0);
});
