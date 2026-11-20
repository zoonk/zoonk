import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { type SavedPlan } from "../../../learner/facts/saved-plan";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type MockIdentity } from "../../../plans/planner/mock-identity";
import {
  parsePlanGraph,
  parsePlanPhases,
  parsePlanSettings,
} from "../../../plans/planner/plan-state";
import { getTestSkillIds } from "../../../sessions/_utils/review-skills";
import { keepExamSubjects } from "../../choices/exam-scope";
import { getFinalStretchStart, isInFinalStretch } from "../../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../../final-stretch/load-final-stretch-start";
import { getMockFormatMix } from "../mock-format-mix";
import { toSubjectCandidates } from "../mock-option-plan";
import { findAreaSubject, getSubjectShares } from "../mock-options";
import {
  type MockCandidate,
  type MockPlan,
  getMockClock,
  getMockDays,
  outlineMock,
  planMock,
} from "../mock-plan";
import { type MockEssayCandidate, getDayWrittenParts } from "../written-parts";
import { loadMockCandidates } from "./mock-candidates";
import { loadMockEssays } from "./mock-essays";
import { type MockListening, loadListeningCandidates } from "./mock-listening";
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
  now,
  exclude,
  itemIds,
  structure,
  userId,
}: {
  client?: TransactionClient;
  goalId: string | null;
  exclude?: ReadonlySet<string>;
  now?: Date;
  itemIds: readonly string[] | null;
  structure: ExamStructure | null;
  userId: string;
}): Promise<MockListening> {
  if (!goalId) {
    return { missingParts: [], recordings: new Map(), unvoiced: new Set() };
  }

  const audio = await loadListeningCandidates({
    client,
    exclude: exclude && [...exclude],
    goalId,
    mix: getMockFormatMix(structure),
    now,
    userId,
  });

  if (!itemIds) {
    return audio;
  }

  const picked = new Set(itemIds);

  return {
    ...audio,
    recordings: new Map(
      [...audio.recordings].flatMap(([name, candidates]) => {
        const kept = candidates.filter((candidate) => picked.has(candidate.itemId));
        return kept.length > 0 ? [[name, kept] as const] : [];
      }),
    ),
  };
}

type WeeklyPaper = {
  skillIds: readonly string[];
  paperPlan?: { graph: unknown; settings: unknown };
  exclude?: ReadonlySet<string>;
  now?: Date;
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

async function scheduledPaper(input: WeeklyPaper) {
  const plan =
    input.paperPlan ??
    input.savedPlan ??
    (input.goal.id &&
      (await (input.client ?? prisma).plan.findUnique({
        select: { graph: true, settings: true },
        where: { goalId: input.goal.id },
      })));

  const { structure } = input;
  const settings = plan ? plan.settings : null;

  const skipped = new Set(
    parsePlanSettings(settings).skippedAreas.flatMap(
      (area) => findAreaSubject({ area, structure })?.name ?? [],
    ),
  );

  const scoped =
    structure && skipped.size > 0
      ? keepExamSubjects(
          structure,
          new Set(
            structure.subjects
              .filter(
                (subject) =>
                  !skipped.has(subject.name) && !(subject.partOf && skipped.has(subject.partOf)),
              )
              .map((subject) => subject.name),
          ),
        )
      : structure;

  return {
    skillIds: getTestSkillIds({
      graph: parsePlanGraph(plan ? plan.graph : null),
      planSkillIds: input.skillIds,
      settings,
    }),
    structure: scoped,
  };
}

export async function loadWeeklyOutline(input: WeeklyPaper) {
  const paper = await scheduledPaper(input);
  return { ...paper, ...(await outlinePaper({ ...input, ...paper })) };
}

async function outlinePaper({
  essays,
  finishedMocks,
  goal,
  identity,
  savedPlan,
  structure,
  today,
  userId,
}: WeeklyPaper) {
  const days = getMockDays(structure);

  const resolveIdentity = async () => {
    if (identity) {
      return identity;
    }

    const [number, finalStretchStart] = await Promise.all([
      finishedMocks ?? countFinishedMocksBefore({ goalId: goal.id }),
      savedPlan
        ? getFinalStretchStart(parsePlanPhases(savedPlan.phases))
        : loadFinalStretchStart(goal.id),
    ]);

    return {
      day: days[number % days.length] ?? null,
      fullLength: isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today }),
    };
  };

  const { day, fullLength } = await resolveIdentity();

  const written =
    fullLength && getDayWrittenParts({ day, structure }).length > 0
      ? (essays ?? (await loadWeeklyMockEssays({ goal, userId })))
      : [];

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
  input: WeeklyPaper,
): Promise<
  MockPlan & {
    outline: MockPlan;
    candidates: MockCandidate[];
    audio: MockListening;
    structure: ExamStructure | null;
    skillIds: string[];
  }
> {
  const { client, goal, itemIds = null, savedPlan, userId } = input;
  const { structure, skillIds } = await scheduledPaper(input);

  const [{ outline, written }, candidates, audio] = await Promise.all([
    outlinePaper({ ...input, structure }),
    loadMockCandidates({
      client,
      goal,
      itemIds,
      now: input.now,
      plan: savedPlan,
      skillIds,
      structure,
      userId,
    }),
    loadWeeklyMockListening({
      client,
      exclude: input.exclude,
      goalId: goal.id,
      itemIds,
      now: input.now,
      structure,
      userId,
    }),
  ]);

  const listening = audio.recordings;
  const { day, fullLength } = outline;
  const days = getMockDays(structure);

  const bySubject = toSubjectCandidates({
    candidates: input.exclude
      ? candidates.filter((item) => !input.exclude?.has(item.itemId))
      : candidates,
    structure,
  });

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

  return { ...plan, audio, candidates: asked, outline, skillIds, structure };
}
