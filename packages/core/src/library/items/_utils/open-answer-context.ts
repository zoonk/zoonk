import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../_utils/library-visibility";
import { parseStepContent } from "../../steps/contract/step-contract";
import { type AnswerExplanationTarget } from "../answer-explanations";
import { parseItemContent } from "../item-content";

export type OpenAnswerContext = {
  acceptedAnswers: string[];
  context: string | null;
  keyPoints: string[];
  language: string;
  question: string;
  sampleAnswer: string;
};

async function getItemContext(itemId: string): Promise<OpenAnswerContext | null> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });

  if (!item) {
    return null;
  }

  const parsed = parseItemContent({ content: item.content, format: item.format });

  if (parsed.format !== "typed" && parsed.format !== "spoken") {
    return null;
  }

  return { ...parsed.content, language: item.language };
}

async function getStepContext({
  stepId,
  userId,
}: {
  stepId: string;
  userId: string;
}): Promise<OpenAnswerContext | null> {
  const step = await prisma.step.findFirst({
    include: { lesson: { select: { language: true } } },
    where: { id: stepId, kind: "typedAnswer", lesson: libraryRowsVisibleTo(userId) },
  });

  if (!step) {
    return null;
  }

  const content = parseStepContent("typedAnswer", step.content);

  return {
    acceptedAnswers: content.acceptedAnswers ?? [],
    context: content.context ?? null,
    keyPoints: content.keyPoints,
    language: step.lesson.language,
    question: content.question,
    sampleAnswer: content.sampleAnswer,
  };
}

/** Use stored questions and keys, never client-supplied context: explanations are shared with later learners. */
export function getOpenAnswerContext({
  target,
  userId,
}: {
  target: AnswerExplanationTarget;
  userId: string;
}): Promise<OpenAnswerContext | null> {
  return "itemId" in target
    ? getItemContext(target.itemId)
    : getStepContext({ stepId: target.stepId, userId });
}
