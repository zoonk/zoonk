import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { claimEssayGrades, releaseEssayGradeClaims } from "../essays/_utils/essay-grade-claims";
import { gradeEssayText, recordEssayGrade } from "../essays/_utils/grade-essay-answer";
import { readMockEssayText } from "./_utils/mock-answers";
import { loadMockEssayItems } from "./_utils/mock-essays";
import { getEssayItemIds } from "./_utils/mock-sections";
import { type MockSitting, type OwnedMock, findOwnedMock } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

export type GradeMockEssaysResult = {
  status: "graded" | "limitReached" | "notFinished" | "notFound" | "unauthorized";
};

/**
 * The essays written and not graded yet, with what grading them needs and the id each grade is
 * recorded under: the same for every request that grades this mock, so they claim it once.
 */
async function listUngradedEssays({ mock, userId }: { mock: MockSitting; userId: string }) {
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

    const attemptId = getAnswerAttemptId({ key: mock.id, questionId: itemId, userId });

    return essay && text && !isGraded
      ? [{ ...essay, attemptId, durationMs: draft?.durationMs ?? 0, text }]
      : [];
  });
}

/**
 * Grades the essays at once (independent model calls), then records them one after another, so
 * two essays on the same skill update its memory in order. Every grade settles before any is
 * recorded or fails the request: one that failed doesn't drop the others, nor free their claims
 * while they're still being graded.
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
  const grades = await Promise.allSettled(
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
        const graded = grades[index];

        if (graded?.status === "fulfilled") {
          await recordEssayGrade({
            attemptId: essay.attemptId,
            durationMs: essay.durationMs,
            grade: graded.value,
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

  const failed = grades.find((graded) => graded.status === "rejected");

  if (failed) {
    throw failed.reason;
  }
}

/**
 * Grades a finished full mock's essays with the exam's official rubric, the model call its
 * hand-in leaves for right after, so the objective result shows at once: each essay written and
 * not graded yet, within the day's essay grades (`limitReached` keeps the rest for another day).
 * Each grade is claimed before the model is called (`claimEssayGrades`), so grading the same mock
 * twice at once grades it once: the second request waits and finds the grades.
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

  const { userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });
  const localDate = getDateInTimeZone({ date: new Date(), timeZone });
  const ungraded = await listUngradedEssays({ mock, userId });

  const claims = await claimEssayGrades({
    attemptIds: ungraded.map((essay) => essay.attemptId),
    localDate,
    userId,
  });

  const claimed = ungraded.filter((essay) =>
    claims.some((claim) => claim.attemptId === essay.attemptId && claim.status === "claimed"),
  );

  try {
    await gradeEssays({ essays: claimed, mock, owned, timeZone });
  } finally {
    // A grade that wasn't recorded frees its claim, so the essay can be graded again.
    await releaseEssayGradeClaims({ attemptIds: claimed.map((essay) => essay.attemptId), userId });
  }

  return {
    status: claims.some((claim) => claim.status === "limitReached") ? "limitReached" : "graded",
  };
}
