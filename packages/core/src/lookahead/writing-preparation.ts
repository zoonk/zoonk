import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readExamPicks } from "../exams/choices/exam-choices";
import { listPracticeWritingTasks } from "../exams/essays/_utils/practice-writing-tasks";
import { type WritingRequest } from "../exams/essays/writing-supply";
import { readMockStructure } from "../exams/mocks/_utils/read-mock-structure";
import { listWrittenRequests } from "../exams/mocks/written-parts";
import { loadScheduledAnswers } from "../learner/facts/scheduled-answers";
import { type WritingSupplyInput } from "../library/items/writing-prompt-pool";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { planWritingScope } from "../plans/planner/plan-writing-scope";
import { keepWritingSchedule, resolveWritingDay } from "../plans/planner/writing-schedule";
import { listWrittenPapers } from "../plans/planner/written-test-planning";
import { getGoalDayMinutes } from "../sessions/_utils/day-minutes";
import { readBlockPayload } from "../sessions/block-payload";

export async function listWritingPreparation({
  goalId,
  timeZone,
  userId,
}: {
  goalId: string;
  timeZone: string;
  userId: string;
}): Promise<WritingSupplyInput[]> {
  const goal = await prisma.goal.findFirst({
    select: {
      dailyMinutes: true,
      examBlueprint: true,
      kind: true,
      plan: { select: { graph: true, settings: true } },
      targetDate: true,
    },
    where: { id: goalId, kind: "exam", userId },
  });

  const blueprint = goal?.examBlueprint;

  if (
    !blueprint ||
    !goal.plan ||
    (blueprint.ownerId !== userId && blueprint.visibility !== "public")
  ) {
    return [];
  }

  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const settings = parsePlanSettings(goal.plan.settings);
  const structure = readMockStructure({ blueprint, picks: readExamPicks(settings) });

  const session = await prisma.studySession.findFirst({
    select: { blocks: { select: { kind: true, payload: true }, where: { status: "pending" } } },
    where: { goalId, localDate: today, userId },
  });

  const { keptSkills, keepsTask } = planWritingScope({
    graph: parsePlanGraph(goal.plan.graph),
    skippedAreas: settings.skippedAreas,
    structure,
  });

  const taskKeys = new Set(
    structure
      ? listPracticeWritingTasks({ classTest: Boolean(blueprint.ownerId), structure })
          .filter((task) => keepsTask(task))
          .map(({ key }) => key)
      : [],
  );

  const saved = settings.writingSchedule;

  const schedule =
    saved && settings.skippedAreas.length > 0 ? keepWritingSchedule(saved, taskKeys) : saved;

  const eligiblePapers =
    structure && settings.skippedAreas.length > 0
      ? new Set(listWrittenPapers({ keepsTask, picks: settings, structure }).map(({ day }) => day))
      : null;

  const allocation =
    !session &&
    schedule?.length &&
    getGoalDayMinutes({ date: today, goal, planSettings: settings }) > 0
      ? resolveWritingDay({
          attempts: await loadScheduledAnswers(userId, goalId),
          schedule,
          today: toIsoDate(today),
        })
      : undefined;

  const keepsPendingWriting = (
    writing: Pick<WritingRequest, "taskKey" | "unit">,
    skillIds: string[],
  ) =>
    settings.skippedAreas.length === 0 ||
    (taskKeys.has(writing.taskKey) &&
      (writing.unit !== "drill" || skillIds.some((id) => keptSkills.has(id))));

  const requests = session
    ? session.blocks.flatMap<WritingRequest>((block) => {
        const { checkpoint, extra, skillIds, writing } = readBlockPayload(block);

        if (
          block.kind === "checkpoint" &&
          checkpoint?.mock &&
          (checkpoint.written || checkpoint.mockIdentity?.fullLength)
        ) {
          const day = checkpoint.mockIdentity?.day ?? null;

          return checkpoint.written && eligiblePapers && !eligiblePapers.has(day)
            ? []
            : listWrittenRequests({ day, structure });
        }

        if (block.kind !== "produce" || extra || !writing || writing.admissionId) {
          return [];
        }

        if (!keepsPendingWriting(writing, skillIds)) {
          return [];
        }

        return [
          {
            count: 1,
            skillId: writing.unit === "drill" ? skillIds[0] : undefined,
            taskKey: writing.taskKey,
            unit: writing.unit,
          },
        ];
      })
    : requestsForAllocation(allocation, structure);

  return requests.map((request) => ({ ...request, goalId, userId, wait: "later" }));
}

function requestsForAllocation(
  day: NonNullable<ReturnType<typeof parsePlanSettings>["writingSchedule"]>[number] | undefined,
  structure: ReturnType<typeof readMockStructure>,
) {
  return day?.test
    ? listWrittenRequests({ day: day.test.day, structure })
    : (day?.tasks ?? []).map(({ taskKey, unit }) => ({ count: 1, taskKey, unit }));
}
