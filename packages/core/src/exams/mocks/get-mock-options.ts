import "server-only";
import { prisma } from "@zoonk/db";
import { readMockEssays } from "../../learner/facts/mock-essays";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { resolveViewGoal } from "../../view-models/_utils/resolve-view-goal";
import { getExamDocument } from "../exam-document";
import { getAnytimeMockAccess } from "./_utils/anytime-mock-access";
import {
  findRunningAnytimeMock,
  loadAnytimeMockSetup,
  resolveAnytimeOption,
} from "./_utils/anytime-mock-setup";
import { canReuseMockItems, planFromBank, isCompleteMock } from "./_utils/create-anytime-mock";
import { findLastMock } from "./_utils/finished-mocks";
import { getBankTypedParts } from "./_utils/mock-typed-parts";
import { type MockOptionsView, mockConditionsSchema, mockShapeSchema } from "./mock-contract";

export type MockOptionsResult =
  | { status: "ready"; view: MockOptionsView }
  | { status: "noGoal" | "notExam" | "notFound" | "unauthorized" };

export async function getMockOptions({
  goalId,
}: { goalId?: string } = {}): Promise<MockOptionsResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  if (goal.kind !== "exam") {
    return { status: "notExam" };
  }

  const [setup, access, running, lastMock] = await Promise.all([
    loadAnytimeMockSetup(
      goal,
      goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : null,
      {
        essays: readMockEssays(goal.userId, goal.id, goal.examBlueprintId),
        plan: readSavedPlan(goal.userId, goal.id),
        typed: getBankTypedParts(goal.examBlueprintId),
      },
    ),
    getAnytimeMockAccess(goal),
    findRunningAnytimeMock({ goalId: goal.id, now: getRequestInstant(), userId: goal.userId }),
    findLastMock(goal.id),
  ]);

  const conditions = running ? mockConditionsSchema.safeParse(running.conditions).data : null;

  const shape = mockShapeSchema.safeParse(goal.requestedMock).data;
  const option = shape && resolveAnytimeOption({ choice: { shape }, setup });
  const requestedPlan =
    option &&
    (await planFromBank({
      goal,
      option,
      setup,
      userId: goal.userId,
      reuse: await canReuseMockItems(prisma, goal.userId),
    }));
  return {
    status: "ready",
    view: {
      requested:
        option && shape && requestedPlan
          ? {
              shape,
              status: isCompleteMock({ option, setup, plan: requestedPlan.plan })
                ? "ready"
                : "preparing",
            }
          : null,
      access,
      examDocument: getExamDocument(goal),
      examName: setup.examName,
      goalId: goal.id,
      lastMock,
      options: setup.options,
      running:
        running && conditions
          ? { id: running.id, purpose: conditions.purpose, shape: conditions.shape }
          : null,
      sizeSource: setup.sizeSource,
    },
  };
}
