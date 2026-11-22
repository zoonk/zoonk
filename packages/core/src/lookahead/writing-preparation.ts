import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readExamPicks } from "../exams/choices/exam-choices";
import { type WritingRequest } from "../exams/essays/writing-supply";
import { readMockStructure } from "../exams/mocks/_utils/read-mock-structure";
import { listWrittenRequests } from "../exams/mocks/written-parts";
import { loadScheduledAnswers } from "../learner/facts/scheduled-answers";
import { type WritingSupplyInput } from "../library/items/writing-prompt-pool";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { resolveWritingDay } from "../plans/planner/writing-schedule";
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
      plan: { select: { settings: true } },
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

  const schedule = settings.writingSchedule;

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

  const requests = session
    ? session.blocks.flatMap<WritingRequest>((block) => {
        const { checkpoint, extra, skillIds, writing } = readBlockPayload(block);

        if (
          block.kind === "checkpoint" &&
          checkpoint?.mock &&
          (checkpoint.written || checkpoint.mockIdentity?.fullLength)
        ) {
          return listWrittenRequests({ day: checkpoint.mockIdentity?.day ?? null, structure });
        }

        if (block.kind !== "produce" || extra || !writing || writing.admissionId) {
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
