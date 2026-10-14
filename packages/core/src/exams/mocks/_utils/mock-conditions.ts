import { type ExamEdition } from "../../../library/exams/blueprint-contract";
import "server-only";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { type OwnedMock } from "./owned-mock";
import { planWeeklyMock } from "./plan-weekly-mock";
import { loadScheduledMock } from "./scheduled-mock";

/**
 * When the real exam starts on the day a mock copies: the start time of that exam day, or of the
 * first one when the exam has a single day.
 */
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

/**
 * The conditions of a scheduled mock: its questions (picked when the session was built) split
 * into the exam day's sections at the real pace, the scoring, and when the real exam starts.
 */
export async function buildMockConditions(
  owned: Pick<OwnedMock, "blueprint" | "goal" | "payload" | "sessionDate" | "structure" | "userId">,
): Promise<MockConditions> {
  const { blueprint, goal, payload, sessionDate, structure, userId } = owned;
  const edition = blueprint ? readBlueprintContent(blueprint).edition : null;

  // The mock sits the exam day and length its plan saved for it (see `MockIdentity`).
  const identity = await loadScheduledMock({
    date: sessionDate,
    goalId: goal?.id ?? null,
    planItemId: payload.planItemId,
  });

  const plan = await planWeeklyMock({
    goal: {
      examBlueprintId: goal?.examBlueprintId ?? null,
      id: goal?.id ?? null,
      targetDate: goal?.targetDate ?? null,
    },
    identity,
    itemIds: payload.itemIds,
    skillIds: payload.skillIds,
    structure,
    today: sessionDate,
    userId,
  });

  return {
    day: plan.day,
    examQuestions: null,
    fullLength: plan.fullLength,
    partialCredit: getPartialCredit(structure),
    purpose: "planned",
    reused: plan.reused,
    scoring: getMockScoring({ blueprint, goal, structure }),
    sections: plan.sections,
    shape: null,
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
    wrongPenalty: getWrongPenalty(structure),
  };
}
