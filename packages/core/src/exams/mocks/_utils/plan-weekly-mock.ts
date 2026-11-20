import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { type SavedPlan } from "../../../learner/facts/saved-plan";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type MockIdentity } from "../../../plans/planner/mock-identity";
import { parsePlanPhases } from "../../../plans/planner/plan-state";
import { getFinalStretchStart, isInFinalStretch } from "../../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../../final-stretch/load-final-stretch-start";
import { getMockFormatMix } from "../mock-format-mix";
import { toSubjectCandidates } from "../mock-option-plan";
import { getSubjectShares } from "../mock-options";
import {
  type MockCandidate,
  type MockPlan,
  getMockClock,
  getMockDays,
  outlineMock,
  planMock,
} from "../mock-plan";
import { type MockEssayCandidate } from "../written-parts";
import { loadMockCandidates } from "./mock-candidates";
import { loadMockEssays } from "./mock-essays";
import { loadListeningCandidates } from "./mock-listening";
import { countFinishedMocksBefore } from "./mock-number";

function loadWeeklyMockEssays({
  goal,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId"> & { id: string | null };
  userId: string;
}): Promise<MockEssayCandidate[]> {
  const { id } = goal;

  return id
    ? loadMockEssays({ goal: { examBlueprintId: goal.examBlueprintId, id }, userId })
    : Promise.resolve([]);
}

async function loadWeeklyMockListening({
  client,
  goalId,
  itemIds,
  structure,
  userId,
}: {
  client?: TransactionClient;
  goalId: string | null;
  itemIds: readonly string[] | null;
  structure: ExamStructure | null;
  userId: string;
}): Promise<Map<string, MockCandidate[]>> {
  if (!goalId) {
    return new Map();
  }

  const { recordings, unvoiced } = await loadListeningCandidates({
    client,
    goalId,
    mix: getMockFormatMix(structure),
    userId,
  });

  const ready = new Map([...recordings].filter(([name]) => !unvoiced.has(name)));

  if (!itemIds) {
    return ready;
  }

  const picked = new Set(itemIds);

  return new Map(
    [...ready].flatMap(([name, candidates]) => {
      const kept = candidates.filter((candidate) => picked.has(candidate.itemId));
      return kept.length > 0 ? [[name, kept] as const] : [];
    }),
  );
}

type WeeklyPaper = {
  client?: TransactionClient;
  essays?: readonly MockEssayCandidate[];
  /** A GET's finished-mock count; without it, it's counted fresh. */
  finishedMocks?: Promise<number>;
  goal: Pick<Goal, "examBlueprintId" | "targetDate"> & { id: string | null };
  identity?: MockIdentity | null;
  itemIds?: readonly string[] | null;
  savedPlan?: SavedPlan;
  structure: ExamStructure | null;
  today: Date;
  userId: string;
};

export async function loadWeeklyOutline({
  essays,
  finishedMocks,
  goal,
  identity,
  savedPlan,
  structure,
  today,
  userId,
}: WeeklyPaper) {
  const [mockNumber, finalStretchStart, written] = await Promise.all([
    identity ? 0 : (finishedMocks ?? countFinishedMocksBefore({ goalId: goal.id })),
    identity
      ? null
      : savedPlan
        ? getFinalStretchStart(parsePlanPhases(savedPlan.phases))
        : loadFinalStretchStart(goal.id),
    essays ?? loadWeeklyMockEssays({ goal, userId }),
  ]);
  const fullLength =
    identity?.fullLength ??
    isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today });

  const days = getMockDays(structure);
  const day = identity ? identity.day : (days[mockNumber % days.length] ?? null);
  const clock = getMockClock({ day, fullLength, structure });

  const declaredListening = new Set(
    (structure?.mock?.sections ?? [])
      .filter((section) => section.kind === "listening")
      .map((section) => section.name),
  );

  const outline = outlineMock({
    clock,
    day,
    essays: written,
    fullLength,
    listening: declaredListening,
    structure,
  });

  return { outline, written };
}

export async function planWeeklyMock(
  input: WeeklyPaper & { skillIds: readonly string[] },
): Promise<MockPlan & { outline: MockPlan; candidates: MockCandidate[] }> {
  const { client, goal, itemIds = null, savedPlan, skillIds, structure, userId } = input;
  const [{ outline, written }, candidates, listening] = await Promise.all([
    loadWeeklyOutline(input),
    loadMockCandidates({ client, goal, itemIds, plan: savedPlan, skillIds, structure, userId }),
    loadWeeklyMockListening({ client, goalId: goal.id, itemIds, structure, userId }),
  ]);
  const { day, fullLength } = outline;
  const days = getMockDays(structure);
  const bySubject = toSubjectCandidates({ candidates, structure });
  const asked = [...bySubject, ...[...listening.values()].flat()];
  const plan = planMock({
    adaptive: structure?.mock?.adaptive ?? false,
    candidates: bySubject,
    essays: written,
    fullLength,
    listening,
    mockNumber: Math.max(0, days.indexOf(day)),
    scheduledOutline: outline,
    structure,
    subjectShares: getSubjectShares(structure),
  });

  return { ...plan, candidates: asked, outline };
}
