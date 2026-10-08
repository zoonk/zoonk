import "server-only";
import { type ExamEdition } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getExamScale } from "../../scoring/exam-scales";
import { type MockConditions } from "../mock-contract";
import { type OwnedMock } from "./owned-mock";
import { getMockScoring, planWeeklyMock } from "./plan-weekly-mock";

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
export async function buildMockConditions(owned: OwnedMock): Promise<MockConditions> {
  const { blueprint, goal, payload, sessionDate, structure, userId } = owned;
  const edition = blueprint ? readBlueprintContent(blueprint).edition : null;

  const plan = await planWeeklyMock({
    goal: {
      examBlueprintId: goal?.examBlueprintId ?? null,
      id: goal?.id ?? null,
      targetDate: goal?.targetDate ?? null,
    },
    itemIds: payload.itemIds,
    skillIds: payload.skillIds,
    structure,
    today: sessionDate,
    userId,
  });

  return {
    day: plan.day,
    fullLength: plan.fullLength,
    purpose: "planned",
    scoring: getMockScoring({ scale: getExamScale({ blueprint, goal }), structure }),
    sections: plan.sections,
    shape: null,
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
  };
}
