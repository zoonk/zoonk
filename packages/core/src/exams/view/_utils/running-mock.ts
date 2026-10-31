import "server-only";
import { prisma } from "@zoonk/db";
import { readBlockPayload } from "../../../sessions/block-payload";
import { readMockAnswer } from "../../mocks/_utils/mock-answers";
import { countFinishedMocksBefore } from "../../mocks/_utils/mock-number";
import { getSectionDeadline, hasStoredTimeRunOutAway } from "../../mocks/_utils/owned-mock";
import { isMockAnswerPresent } from "../../mocks/mock-answer-presence";
import { mockConditionsSchema } from "../../mocks/mock-contract";
import { type ExamNextMock, type ExamRunningMock } from "../exam-view-contract";

type RunningMock = { mock: ExamRunningMock; planItemId: string | null };

function findActiveMocks({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.mockExam.findMany({
    include: {
      answers: { select: { answer: true } },
      block: { select: { id: true, payload: true } },
    },
    orderBy: { startedAt: "desc" },
    where: { goalId, status: "active", userId },
  });
}

type ActiveMock = Awaited<ReturnType<typeof findActiveMocks>>[number];

async function toRunningMock({
  goalId,
  row,
}: {
  goalId: string;
  row: ActiveMock;
}): Promise<RunningMock | null> {
  const conditions = mockConditionsSchema.safeParse(row.conditions).data;

  if (!conditions) {
    return null;
  }

  const earlier = await countFinishedMocksBefore({ createdAt: row.createdAt, goalId });
  const { sections } = conditions;

  return {
    mock: {
      answered: row.answers.filter((draft) => isMockAnswerPresent(readMockAnswer(draft.answer)))
        .length,
      deadline:
        row.sectionIndex < sections.length
          ? getSectionDeadline({ ...row, conditions }).toISOString()
          : null,
      id: row.blockId ?? row.id,
      number: earlier + 1,
      purpose: conditions.purpose,
      questions: sections.reduce(
        (sum, section) => sum + section.questions + section.essays.length,
        0,
      ),
      shape: conditions.shape,
    },
    planItemId: row.block ? readBlockPayload(row.block).planItemId : null,
  };
}

export async function loadRunningMocks({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<RunningMock[]> {
  const active = await findActiveMocks({ goalId, userId });

  const now = Date.now();
  const running = active.filter((mock) => !hasStoredTimeRunOutAway({ mock, now }));

  const ordered = [
    ...running.filter((mock) => mock.blockId === null),
    ...running.filter((mock) => mock.blockId !== null),
  ];

  const mocks = await Promise.all(ordered.map((row) => toRunningMock({ goalId, row })));
  return mocks.filter((mock) => mock !== null);
}

export function pickExamMocks({
  next,
  running,
}: {
  next: ExamNextMock | null;
  running: RunningMock[];
}): { nextMock: ExamNextMock | null; runningMocks: ExamRunningMock[] } {
  const started = running.some(
    (mock) => mock.planItemId !== null && mock.planItemId === next?.planItemId,
  );

  return { nextMock: started ? null : next, runningMocks: running.map((mock) => mock.mock) };
}
