import { type ExamEdition } from "../../../library/exams/blueprint-contract";
import "server-only";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { markPlannedItems } from "../mock-marking";
import { listLeftOutChoices } from "../mock-unpicked";
import { outlineWrittenPrompts, planWrittenTest } from "../written-test-plan";
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
): Promise<MockConditions> {
  const { blueprint, goal, payload, sessionDate, structure, unpicked, userId } = owned;
  const edition = blueprint ? readBlueprintContent(blueprint).edition : null;

  const identity = payload.checkpoint?.mockIdentity;

  if (!identity) {
    throw new Error("A scheduled mock is missing its saved exam day and length");
  }

  const written = payload.checkpoint?.written === true;
  const essays = outlineWrittenPrompts({ day: identity.day, structure });

  const plan = written
    ? { ...planWrittenTest({ day: identity.day, essays, structure }), candidates: [] }
    : await planWeeklyMock({
        essays,
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
    ...markPlannedItems({ candidates: plan.candidates, plan, structure }),
    ...(written && { pacing: "official" as const }),
    partialCredit: getPartialCredit(structure),
    purpose: "planned",
    reused: plan.reused,
    scoring: getMockScoring({ blueprint, goal, structure }),
    sections: plan.sections,
    shape: written ? { area: null, day: plan.day, kind: "written" } : null,
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
    unpicked: written
      ? []
      : listLeftOutChoices({ day: plan.day, kind: plan.fullLength ? "full" : "half", unpicked }),
    wrongPenalty: getWrongPenalty(structure),
  };
}
