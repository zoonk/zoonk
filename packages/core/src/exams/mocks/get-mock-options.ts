import "server-only";
import { readMockEssays } from "../../learner/facts/mock-essays";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { resolveViewGoal } from "../../view-models/_utils/resolve-view-goal";
import { getExamDocument } from "../exam-document";
import { getAnytimeMockAccess } from "./_utils/anytime-mock-access";
import {
  findPlacementMock,
  findRunningAnytimeMock,
  loadAnytimeMockSetup,
} from "./_utils/anytime-mock-setup";
import { findLastMock } from "./_utils/finished-mocks";
import { getBankTypedParts } from "./_utils/mock-typed-parts";
import { type MockOptionsView, mockConditionsSchema } from "./mock-contract";
import { getRecommendedPlacementLength, toPlacementOptionView } from "./placement-mock";

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

  const [setup, access, running, placementMock, lastMock] = await Promise.all([
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
    findPlacementMock({ goalId: goal.id, userId: goal.userId }),
    findLastMock(goal.id),
  ]);

  const conditions = running ? mockConditionsSchema.safeParse(running.conditions).data : null;
  const recommended = getRecommendedPlacementLength(setup.placement);

  return {
    status: "ready",
    view: {
      access,
      examDocument: getExamDocument(goal),
      examName: setup.examName,
      goalId: goal.id,
      lastMock,
      options: setup.options,
      placement: recommended && {
        mock: placementMock && {
          id: placementMock.id,
          status: placementMock.status === "finished" ? "finished" : "running",
        },
        options: setup.placement.map((option) => toPlacementOptionView(option)),
        recommended,
      },
      running:
        running && conditions
          ? { id: running.id, purpose: conditions.purpose, shape: conditions.shape }
          : null,
      sizeSource: setup.sizeSource,
    },
  };
}
