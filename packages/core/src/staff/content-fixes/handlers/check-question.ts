import { type ItemFormat, type Step, type StepKind, type TransactionClient } from "@zoonk/db";
import { saveQuestionItem } from "../../../library/lessons/_utils/screen-question-item";
import { retireUnaskedQuestions } from "../../../library/lessons/lesson-versions";
import { toCheckQuestion } from "../../../library/steps/_utils/check-question";

export type ScreenRow = {
  item: { format: ItemFormat; id: string } | null;
  kind: StepKind;
  lessonId: string;
  retiredAt: Date | null;
  sentenceId: string | null;
  staged: boolean;
  wordId: string | null;
};

export const screenSelect = {
  item: { select: { format: true, id: true } },
  kind: true,
  lessonId: true,
  retiredAt: true,
  sentenceId: true,
  staged: true,
  wordId: true,
} as const;

export function bankedCheckRef(
  model: "Step" | "StepVariant",
  step: ScreenRow,
): { checkItemId?: string } {
  return model === "Step" && step.kind === "check" && step.item?.format === "multipleChoice"
    ? { checkItemId: step.item.id }
    : {};
}

export async function syncStepCheckQuestion(tx: TransactionClient, step: Step) {
  if (!step.itemId || step.kind !== "check") {
    return;
  }

  const previous = await tx.item.findUniqueOrThrow({
    include: { skill: { select: { ownerId: true } } },
    where: { id: step.itemId },
  });

  if (previous.format !== "multipleChoice") {
    return;
  }

  const lesson = await tx.lesson.findUniqueOrThrow({
    select: { language: true, ownerId: true },
    where: { id: step.lessonId },
  });

  const question =
    !step.mediaAssetId && lesson.ownerId === previous.skill.ownerId
      ? toCheckQuestion(step.content)
      : null;

  const itemId = await saveQuestionItem(tx, {
    language: lesson.language,
    previous,
    screen: { provenance: step, question, skillId: step.skillId },
  });

  if (itemId !== previous.id) {
    await tx.step.update({ data: { itemId }, where: { id: step.id } });
    await retireUnaskedQuestions(tx, { itemIds: [previous.id] }, { sourcesLocked: true });
  }
}
