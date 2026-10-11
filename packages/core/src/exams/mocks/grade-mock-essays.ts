import "server-only";
import { prisma, sql } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { countGradesLeft } from "../essays/_utils/essay-drafts";
import { gradeEssayText, recordEssayGrade } from "../essays/_utils/grade-essay-answer";
import { readMockEssayText } from "./_utils/mock-answers";
import { loadMockEssayItems } from "./_utils/mock-essays";
import { getEssayItemIds } from "./_utils/mock-sections";
import { type MockSitting, type OwnedMock, findOwnedMock } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

/** Namespaces the per-mock essay-grading lock so it never collides with other advisory locks. */
const ESSAY_LOCK_NAMESPACE = 51_883;

/**
 * Three essays graded at once take about as long as one (up to half a minute with a fallback
 * model); a second request waits that long for the first one's grades instead of paying again.
 */
const ESSAY_GRADING_TIMEOUT_MS = 180_000;

export type GradeMockEssaysResult = {
  status: "graded" | "limitReached" | "notFinished" | "notFound" | "unauthorized";
};

/** The essays written and not graded yet, with what grading them needs. */
async function listUngradedEssays(mock: MockSitting) {
  const itemIds = getEssayItemIds(mock.conditions);

  const [items, graded] = await Promise.all([
    loadMockEssayItems(itemIds),
    prisma.attempt.findMany({
      select: { itemId: true },
      where: { itemId: { in: itemIds }, mockExamId: mock.id },
    }),
  ]);

  return itemIds.flatMap((itemId) => {
    const essay = items.get(itemId);
    const draft = mock.answers.find((answer) => answer.itemId === itemId);
    const text = readMockEssayText(draft?.answer);
    const isGraded = graded.some((attempt) => attempt.itemId === itemId);

    return essay && text && !isGraded
      ? [{ ...essay, durationMs: draft?.durationMs ?? 0, text }]
      : [];
  });
}

/**
 * Grades the essays at once (independent model calls), then records them one after another, so
 * two essays on the same skill update its memory in order.
 */
async function gradeEssays({
  essays,
  mock,
  owned,
  timeZone,
}: {
  essays: Awaited<ReturnType<typeof listUngradedEssays>>;
  mock: MockSitting;
  owned: OwnedMock;
  timeZone: string;
}) {
  const grades = await Promise.all(
    essays.map((essay) =>
      gradeEssayText({
        blueprint: owned.blueprint,
        content: essay.content,
        goalId: owned.goal?.id,
        language: owned.goal?.language ?? essay.item.language,
        text: essay.text,
        userId: owned.userId,
      }),
    ),
  );

  await essays.reduce(
    (previous, essay, index) =>
      previous.then(async () => {
        const grade = grades[index];

        if (grade) {
          await recordEssayGrade({
            durationMs: essay.durationMs,
            grade,
            item: essay.item,
            mockExamId: mock.id,
            studySessionId: owned.block?.sessionId ?? null,
            text: essay.text,
            timeZone,
            userId: owned.userId,
          });
        }
      }),
    Promise.resolve(),
  );
}

/**
 * Grades a finished full mock's essays with the exam's official rubric, the model call its
 * hand-in leaves for right after, so the objective result shows at once: each essay written and
 * not graded yet, within the day's essay grades (`limitReached` keeps the rest for another day).
 * Grading the same mock twice at once grades it once: the second request waits and finds the
 * grades.
 */
export async function gradeMockEssays({
  blockId,
  input,
}: {
  blockId: string;
  input: MockTimeZoneInput;
}): Promise<GradeMockEssaysResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;
  const { mock } = owned;

  if (mock?.status !== "finished") {
    return { status: "notFinished" };
  }

  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });
  const localDate = getDateInTimeZone({ date: new Date(), timeZone });

  return prisma.$transaction(
    async (tx): Promise<GradeMockEssaysResult> => {
      await tx.$queryRaw(
        sql`SELECT pg_advisory_xact_lock(${ESSAY_LOCK_NAMESPACE}::int, hashtext(${mock.id}))::text`,
      );

      const [ungraded, left] = await Promise.all([
        listUngradedEssays(mock),
        countGradesLeft({ localDate, userId: owned.userId }),
      ]);

      const now = ungraded.slice(0, left);

      await gradeEssays({ essays: now, mock, owned, timeZone });

      return { status: now.length < ungraded.length ? "limitReached" : "graded" };
    },
    { timeout: ESSAY_GRADING_TIMEOUT_MS },
  );
}
