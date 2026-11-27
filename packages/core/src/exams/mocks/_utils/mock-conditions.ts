import { type TransactionClient } from "@zoonk/db";
import "server-only";
import { type ExamEdition } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { markPlannedItems } from "../mock-marking";
import { type MockPlan, countPlannedQuestions } from "../mock-plan";
import { listLeftOutChoices } from "../mock-unpicked";
import { outlineWrittenPrompts, planWrittenTest } from "../written-test-plan";
import { isScheduledPaperComplete } from "./mock-complete";
import { type OwnedMock } from "./owned-mock";
import { loadWeeklyOutline, planWeeklyMock } from "./plan-weekly-mock";

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

type ScheduledMock = Pick<
  OwnedMock,
  "blueprint" | "goal" | "payload" | "sessionDate" | "structure" | "unpicked" | "userId"
>;

function paperInputs({ goal, payload, sessionDate, structure, userId }: ScheduledMock) {
  return {
    goal: {
      examBlueprintId: goal?.examBlueprintId ?? null,
      id: goal?.id ?? null,
      targetDate: goal?.targetDate ?? null,
    },
    identity: payload.checkpoint?.mockIdentity,
    skillIds: payload.skillIds,
    structure,
    today: sessionDate,
    userId,
  };
}

/** The plan's written test sits only the written questions, so it draws nothing from the bank. */
function planScheduledWrittenTest({ payload, structure }: ScheduledMock) {
  const day = payload.checkpoint?.mockIdentity?.day ?? null;

  return payload.checkpoint?.written
    ? planWrittenTest({ day, essays: outlineWrittenPrompts({ day, structure }), structure })
    : null;
}

async function outlineScheduledPaper(owned: ScheduledMock): Promise<MockPlan> {
  const writtenTest = planScheduledWrittenTest(owned);

  if (writtenTest) {
    return writtenTest;
  }

  const { outline } = await loadWeeklyOutline(paperInputs(owned));
  return outline;
}

export async function previewMockConditions(owned: ScheduledMock): Promise<MockConditions> {
  const outline = await outlineScheduledPaper(owned);
  return toPlannedConditions({ ...owned, bank: { candidates: [], outline }, plan: outline });
}

/** `hasQuestions` covers the bank's questions and recordings; the caller checks the written prompts. */
export async function buildMockConditions({
  owned,
  client,
  graph,
}: {
  owned: ScheduledMock;
  client: TransactionClient;
  graph: unknown;
}) {
  const writtenTest = planScheduledWrittenTest(owned);

  if (writtenTest) {
    return {
      conditions: toPlannedConditions({
        ...owned,
        bank: { candidates: [], outline: writtenTest },
        plan: writtenTest,
      }),
      hasQuestions: true,
    };
  }

  const bank = await planWeeklyMock({ ...paperInputs(owned), client, graph });

  return {
    conditions: toPlannedConditions({ ...owned, bank, plan: bank }),
    hasQuestions: isScheduledPaperComplete(bank, true),
  };
}

export function toPlannedConditions({
  bank,
  blueprint,
  goal,
  payload,
  plan,
  structure,
  unpicked,
}: Pick<OwnedMock, "blueprint" | "goal" | "structure" | "unpicked"> & {
  bank: Pick<Awaited<ReturnType<typeof planWeeklyMock>>, "candidates" | "outline">;
  payload?: OwnedMock["payload"];
  plan: MockPlan;
}): MockConditions {
  const edition = blueprint ? readBlueprintContent(blueprint).edition : null;
  const written = payload?.checkpoint?.written === true;

  return {
    day: plan.day,
    examQuestions: countPlannedQuestions(bank.outline),
    fullLength: plan.fullLength,
    ...markPlannedItems({ candidates: bank.candidates, plan, structure }),
    ...(written && { pacing: "official" as const }),
    partialCredit: getPartialCredit(structure),
    purpose: "planned",
    reused: plan.reused,
    scoring: getMockScoring({ blueprint, goal, structure }),
    sections: plan.sections,
    shape: written ? { area: null, day: plan.day, kind: "written" } : null,
    shufflesOptions: true,
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
    unpicked: written
      ? []
      : listLeftOutChoices({ day: plan.day, kind: plan.fullLength ? "full" : "half", unpicked }),
    wrongPenalty: getWrongPenalty(structure),
  };
}
