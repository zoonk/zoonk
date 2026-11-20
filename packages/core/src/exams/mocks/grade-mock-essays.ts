import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { claimEssayGrades, releaseEssayGradeClaims } from "../essays/_utils/essay-grade-claims";
import {
  gradeEssayText,
  gradeWriting,
  recordEssayGrade,
} from "../essays/_utils/grade-essay-answer";
import { getWritingAttemptId } from "../essays/_utils/writing-attempt-id";
import { countWritingLines } from "../essays/writing-lines";
import { readMockEssayText } from "./_utils/mock-answers";
import { loadMockEssayItems, readMockWriting } from "./_utils/mock-essays";
import { getEssayItemIds } from "./_utils/mock-sections";
import { type MockSitting, type OwnedMock, findOwnedMock } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

export type GradeMockEssaysResult = {
  status: "graded" | "limitReached" | "notFinished" | "notFound" | "unauthorized";
};

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

    const { writingAdmissionId: admissionId } = mock.conditions;

    const attemptId = admissionId
      ? getWritingAttemptId({ admissionId, itemId })
      : getAnswerAttemptId({ key: mock.id, questionId: itemId, userId });

    return essay && text && !isGraded
      ? [{ ...essay, attemptId, durationMs: draft?.durationMs ?? 0, text }]
      : [];
  });
}

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
    essays.map(async (essay) => {
      const common = {
        durationMs: essay.durationMs,
        item: essay.item,
        mockExamId: mock.id,
        studySessionId: owned.block?.sessionId ?? null,
        text: essay.text,
        timeZone,
        userId: owned.userId,
      };

      const language = owned.goal?.language ?? essay.item.language;
      const { writingAdmissionId: admissionId } = mock.conditions;

      if (admissionId) {
        const writing = readMockWriting(essay.item);

        if (!writing) {
          throw new Error("An admitted mock answer is missing its scoring basis.");
        }

        const { estimatedLines } = countWritingLines({
          charactersPerLine: writing.charactersPerLine,
          limit: writing.lines,
          text: essay.text,
        });

        const conditions = {
          admissionId,
          estimatedLines,
          origin: "mock" as const,
          timed: true,
          version: "firstDraft" as const,
        };

        const grade = await gradeWriting({
          conditions,
          content: essay.content,
          language,
          previousNextSteps: [],
          text: essay.text,
        });

        return { ...common, conditions, grade };
      }

      const grade = await gradeEssayText({
        blueprint: owned.blueprint,
        content: essay.content,
        goalId: owned.goal?.id,
        language,
        text: essay.text,
        userId: owned.userId,
      });

      return { ...common, attemptId: essay.attemptId, grade };
    }),
  );

  await grades.reduce(async (previous, grade) => {
    await previous;

    if (grade.status === "fulfilled") {
      const outcome = await recordEssayGrade(grade.value);

      if (outcome.status === "refused") {
        throw new Error("The finished mock no longer owns this grade admission.");
      }
    }
  }, Promise.resolve());

  const failed = grades.find((graded) => graded.status === "rejected");

  if (failed) {
    throw failed.reason;
  }
}

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
    admissionId: mock.conditions.writingAdmissionId,
    attemptIds: ungraded.map((essay) => essay.attemptId),
    localDate,
    userId,
  });

  const claimed = ungraded.filter((essay) =>
    claims.some((claim) => claim.attemptId === essay.attemptId && claim.status === "claimed"),
  );

  if (claims.some((claim) => claim.status === "notAdmitted")) {
    throw new Error("The mock's grade claims do not match its writing admission.");
  }

  try {
    await gradeEssays({ essays: claimed, mock, owned, timeZone });
  } finally {
    await releaseEssayGradeClaims({ attemptIds: claimed.map((essay) => essay.attemptId), userId });
  }

  return {
    status: claims.some(
      (claim) => claim.status === "limitReached" || claim.status === "signUpRequired",
    )
      ? "limitReached"
      : "graded",
  };
}
