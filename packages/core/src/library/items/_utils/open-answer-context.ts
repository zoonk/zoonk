import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../_utils/library-visibility";
import { parseStepContent } from "../../steps/contract/step-contract";
import { type AnswerExplanationTarget } from "../answer-explanations";
import { parseItemContent } from "../item-content";

/** What explaining a typed answer needs, from an item or a lesson step. */
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

/** Private lessons are made for one learner, so only their owner can ask about their steps. */
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

/**
 * Reads the question, key points and answers behind a typed answer from the
 * stored item or step, never from the caller, because the explanation is
 * shared with every learner who gives the same answer.
 */
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
