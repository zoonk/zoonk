import "server-only";
import { prisma } from "@zoonk/db";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { claimEssayGrades, releaseEssayGradeClaims } from "../essays/_utils/essay-grade-claims";
import { gradeWriting, recordEssayGrade } from "../essays/_utils/grade-essay-answer";
import { getWritingAttemptId } from "../essays/_utils/writing-attempt-id";
import { readMockEssayText } from "./_utils/mock-answers";
import { loadSkillAreas } from "./_utils/mock-candidates";
import { loadMockEssayItems } from "./_utils/mock-essays";
import { getEssayItemIds } from "./_utils/mock-sections";
import { type MockSitting, type OwnedMock, findOwnedMock } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

export type GradeMockEssaysResult = {
  status: "graded" | "notFinished" | "notFound" | "unauthorized";
};

async function listUngradedEssays({
  admissionId,
  mock,
}: {
  admissionId: string;
  mock: MockSitting;
}) {
  const itemIds = getEssayItemIds(mock.conditions);

  const asked = itemIds.map((itemId) => ({
    attemptId: getWritingAttemptId({ admissionId, itemId }),
    itemId,
  }));
  const graded = await prisma.attempt.findMany({
    select: { id: true },
    where: { id: { in: asked.map(({ attemptId }) => attemptId) }, mockExamId: mock.id },
  });
  const saved = new Set(graded.map(({ id }) => id));
  const ungraded = asked.filter(({ attemptId }) => !saved.has(attemptId));
  const items = await loadMockEssayItems(ungraded.map(({ itemId }) => itemId));

  return ungraded.flatMap(({ attemptId, itemId }) => {
    const essay = items.get(itemId);
    const draft = mock.answers.find((answer) => answer.itemId === itemId);
    const text = readMockEssayText(draft?.answer);
    return essay && text ? [{ ...essay, attemptId, durationMs: draft?.durationMs ?? 0, text }] : [];
  });
}

async function gradeEssays({
  admissionId,
  essays,
  mock,
  owned,
  timeZone,
}: {
  admissionId: string;
  essays: Awaited<ReturnType<typeof listUngradedEssays>>;
  mock: MockSitting;
  owned: OwnedMock;
  timeZone: string;
}) {
  const areas = owned.goal && essays.length > 0 ? await loadSkillAreas(owned.goal.id) : null;

  const grades = await Promise.allSettled(
    essays.map(async (essay) => {
      const common = {
        durationMs: essay.durationMs,
        item: essay.item,
        mockExamId: mock.id,
        mockPrompt: {
          area: areas?.get(essay.item.skillId) ?? null,
          context: essay.content.context,
          question: essay.content.question,
        },
        studySessionId: owned.block?.sessionId ?? null,
        text: essay.text,
        timeZone,
        userId: owned.userId,
      };

      const grade = await gradeWriting({
        analytics: { contentScope: "personal", distinctId: owned.userId, goalId: owned.goal?.id },
        content: essay.content,
        language: essay.item.language,
        previousNextSteps: [],
        text: essay.text,
      });

      return {
        ...common,
        conditions: {
          admissionId,
          origin: "mock" as const,
          timed: true,
          version: "firstDraft" as const,
        },
        grade,
      };
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
  const { writingAdmissionId: admissionId } = mock.conditions;

  if (!admissionId) {
    return { status: getEssayItemIds(mock.conditions).length === 0 ? "graded" : "notFound" };
  }

  const ungraded = await listUngradedEssays({ admissionId, mock });

  const claims = await claimEssayGrades({
    admissionId,
    attemptIds: ungraded.map((essay) => essay.attemptId),
    userId,
  });

  const claimed = ungraded.filter((essay) =>
    claims.some((claim) => claim.attemptId === essay.attemptId && claim.status === "claimed"),
  );

  if (claims.some((claim) => claim.status === "notAdmitted")) {
    throw new Error("The mock's grade claims do not match its writing admission.");
  }

  try {
    await gradeEssays({ admissionId, essays: claimed, mock, owned, timeZone });
  } finally {
    await releaseEssayGradeClaims({ attemptIds: claimed.map((essay) => essay.attemptId), userId });
  }

  return { status: "graded" };
}
