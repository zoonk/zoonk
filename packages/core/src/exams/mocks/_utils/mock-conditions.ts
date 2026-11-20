import { type TransactionClient } from "@zoonk/db";
import "server-only";
import { type ExamEdition } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { markPlannedItems } from "../mock-marking";
import { type MockPlan, countPlannedQuestions } from "../mock-plan";
import { listLeftOutChoices } from "../mock-unpicked";
import { isScheduledPaperComplete } from "./mock-complete";
import { type OwnedMock } from "./owned-mock";
import { planWeeklyMock } from "./plan-weekly-mock";

export function getExamStartTime({
  day,
  edition,
}: {
  day: number | null;
  edition: ExamEdition | null;
}): string | null {
  const examDays = (edition?.dates ?? [])
    .filter((date) => date.kind === "exam")
    .toSorted((first, second) => first.date.localeCompare(second.date));

  const index = day === null ? 0 : day - 1;
  return (examDays[index] ?? examDays[0])?.startTime ?? null;
}

export async function buildMockConditions(
  owned: Pick<
    OwnedMock,
    "blueprint" | "goal" | "payload" | "sessionDate" | "structure" | "unpicked" | "userId"
  >,
  client?: TransactionClient,
) {
  const { goal, payload, sessionDate, structure, userId } = owned;

  const identity = payload.checkpoint?.mockIdentity;

  const bank = await planWeeklyMock({
    client,
    goal: {
      examBlueprintId: goal?.examBlueprintId ?? null,
      id: goal?.id ?? null,
      targetDate: goal?.targetDate ?? null,
    },
    identity,
    itemIds: null,
    skillIds: payload.skillIds,
    structure,
    today: sessionDate,
    userId,
  });

  return {
    complete: isScheduledPaperComplete(bank),
    conditions: toPlannedConditions({
      ...owned,
      structure: bank.structure,
      bank,
      plan: client ? bank : bank.outline,
    }),
  };
}

export function toPlannedConditions({
  bank,
  blueprint,
  goal,
  plan,
  structure,
  unpicked,
}: Pick<OwnedMock, "blueprint" | "goal" | "structure" | "unpicked"> & {
  bank: Awaited<ReturnType<typeof planWeeklyMock>>;
  plan: MockPlan;
}): MockConditions {
  const edition = blueprint ? readBlueprintContent(blueprint).edition : null;

  return {
    day: plan.day,
    examQuestions: countPlannedQuestions(bank.outline),
    fullLength: plan.fullLength,
    ...markPlannedItems({ candidates: bank.candidates, plan, structure }),
    partialCredit: getPartialCredit(structure),
    purpose: "planned",
    reused: plan.reused,
    scoring: getMockScoring({ blueprint, goal, structure }),
    sections: plan.sections,
    shape: null,
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
    unpicked: listLeftOutChoices({
      day: plan.day,
      kind: plan.fullLength ? "full" : "half",
      unpicked,
    }),
    wrongPenalty: getWrongPenalty(structure),
  };
}
