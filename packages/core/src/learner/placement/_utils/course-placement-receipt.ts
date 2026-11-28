import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { type loadPlacementWithSummary } from "./load-placement-state";
import { savePlacementAttempt } from "./placement-attempt";
import { type PlacementRecord } from "./placement-attempt-record";
import { readPlacementCourse } from "./placement-result";

export async function storeFinishedResult({
  attempt,
  attemptQuestions,
  current,
  finish,
  goalId,
  held,
  lessonsSkipped,
  now,
  receipt,
  record,
  testedOutPlanItemIds,
  tx,
}: {
  attempt: NonNullable<PlacementRecord["attempt"]>;
  attemptQuestions: NonNullable<
    Awaited<ReturnType<typeof loadPlacementWithSummary>>["attemptQuestions"]
  >;
  current: Goal;
  finish: NonNullable<PlacementRecord["finishedParts"][number]["finish"]>;
  goalId: string;
  held: { heldUntilTomorrow?: true };
  lessonsSkipped: number;
  now: Date;
  receipt: PlacementRecord["finishedParts"][number];
  record: PlacementRecord;
  testedOutPlanItemIds: string[];
  tx: TransactionClient;
}) {
  const result = { attemptId: attempt.id, finish, finishedAt: now.toISOString() };

  if (attempt.search) {
    const first = attempt.search.topics?.find(
      (topic) => !attemptQuestions.startedPastSkillIds.includes(topic.id),
    );

    await savePlacementAttempt({
      goal: current,
      record: {
        attempt: null,
        result: { ...result, chapter: first?.chapter ?? null, courseStart: true },
      },
      tx,
    });

    return;
  }

  const { chapter, course, nextLesson } = await readPlacementCourse(
    goalId,
    new Set(testedOutPlanItemIds),
    tx,
  );

  await savePlacementAttempt({
    goal: current,
    record: {
      attempt: null,
      finishedParts: [...record.finishedParts, receipt],
      result: { ...held, ...result, chapter, course, lessonsSkipped, nextLesson },
    },
    tx,
  });
}

export function makeReceipt({
  attempt,
  attemptQuestions,
  confirmed,
  heldUntilTomorrow,
  last,
  part,
  partLessonsSkipped,
  testedOutPlanItemIds,
}: {
  attempt: NonNullable<PlacementRecord["attempt"]>;
  attemptQuestions: NonNullable<
    Awaited<ReturnType<typeof loadPlacementWithSummary>>["attemptQuestions"]
  >;
  confirmed: ReadonlySet<string>;
  last: PlacementRecord["finishedParts"][number] | undefined;
  heldUntilTomorrow: boolean;
  part: number;
  partLessonsSkipped: number;
  testedOutPlanItemIds: string[];
}) {
  const newTopics = attempt.search
    ? null
    : new Set(attemptQuestions.partAnswers.slice(last?.finish?.answered));

  const lessonsSkipped = attempt.lessonsSkipped + partLessonsSkipped;
  const held = heldUntilTomorrow ? { heldUntilTomorrow: true as const } : {};

  const finish = {
    answered: attemptQuestions.answered,
    end: attemptQuestions.end,
    lessonsSkipped: partLessonsSkipped,
    unknowns: attemptQuestions.unknowns,
  };

  const receipt = {
    ...held,
    finish,
    knownSkillIds: newTopics ? [...confirmed].filter((id) => newTopics.has(id)) : [],
    lessonsSkipped: partLessonsSkipped,
    part,
    testedOutPlanItemIds,
  };

  return { finish, held, lessonsSkipped, receipt };
}
