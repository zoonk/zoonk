import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { readMockAnswer } from "../../exams/mocks/_utils/mock-answers";
import { listShortParts } from "../../exams/mocks/mock-adapt-rules";
import { isMockAnswerPresent } from "../../exams/mocks/mock-answer-presence";
import { mockResultSchema } from "../../exams/mocks/mock-contract";
import { type PlanSettings } from "../planner/plan-state";
import { type MockMiss } from "../planner/skill-order";

/** After four weeks of study a mock's misses say little about what the learner knows now. */
const MOCK_MISSES_DAYS = 28;

export async function findLatestFinishedMock({
  db = prisma,
  goalId,
  since,
}: {
  db?: TransactionClient;
  goalId: string;
  since: Date;
}): Promise<{ id: string } | null> {
  return db.mockExam.findFirst({
    orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
    select: { id: true },
    where: {
      NOT: { conditions: { equals: "placement", path: ["purpose"] } },
      finishedAt: { gte: since },
      goalId,
      status: "finished",
    },
  });
}

export function findMockToFollow({
  db,
  goalId,
  now,
}: {
  db?: TransactionClient;
  goalId: string;
  now: Date;
}) {
  return findLatestFinishedMock({
    db,
    goalId,
    since: new Date(now.getTime() - MOCK_MISSES_DAYS * MS_PER_DAY),
  });
}

/**
 * A blank is a pacing matter, so only answered questions count, read from each one's outcome: a
 * topic's numbers in the result count its blanks too. A miss in a part that fell under its
 * minimum is a `shortPart` miss.
 */
export async function loadMockMisses(mockId: string): Promise<Map<string, MockMiss>> {
  const mock = await prisma.mockExam.findUnique({
    select: {
      answers: { select: { answer: true, itemId: true } },
      attempts: { select: { isCorrect: true, itemId: true, skillId: true } },
      result: true,
    },
    where: { id: mockId },
  });

  if (!mock) {
    return new Map();
  }

  const answered = new Set(
    mock.answers.flatMap((answer) =>
      isMockAnswerPresent(readMockAnswer(answer.answer)) ? [answer.itemId] : [],
    ),
  );

  const missed = new Set(
    mock.attempts.flatMap((attempt) =>
      attempt.skillId && attempt.itemId && !attempt.isCorrect && answered.has(attempt.itemId)
        ? [attempt.skillId]
        : [],
    ),
  );

  const result = mockResultSchema.safeParse(mock.result).data;
  const shortParts = result ? listShortParts(result) : new Set<string>();

  const shortAreas = new Set(
    result?.areas.flatMap((area) => (area.part && shortParts.has(area.part) ? [area.name] : [])),
  );

  const areaOf = new Map(result?.topics.map((topic) => [topic.skillId, topic.area]));

  return new Map(
    [...missed].toSorted().map((skillId) => {
      const area = areaOf.get(skillId);
      return [skillId, area && shortAreas.has(area) ? "shortPart" : "missed"];
    }),
  );
}

/** The plan follows a mock's misses only while it is the latest one and the plan applied it. */
export async function loadPlanMockMisses({
  goalId,
  mockReplan,
  now,
}: {
  goalId: string;
  mockReplan: PlanSettings["mockReplan"];
  now: Date;
}): Promise<Map<string, MockMiss>> {
  if (!mockReplan?.applied) {
    return new Map();
  }

  const latest = await findMockToFollow({ goalId, now });
  return latest?.id === mockReplan.mockId ? loadMockMisses(latest.id) : new Map();
}
