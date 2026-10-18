import "server-only";
import { explainWrongAnswer } from "@zoonk/ai/tasks/v2/grading/explain-wrong-answer";
import {
  matchTypedAnswer,
  normalizeTypedAnswer,
} from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { getOpenAnswerContext } from "./_utils/open-answer-context";
import {
  type AnswerExplanationTarget,
  findAnswerExplanation,
  saveAnswerExplanation,
} from "./answer-explanations";

/** Typed answers are short and spoken ones are transcripts; longer input is not an answer. */
const MAX_EXPLAINED_ANSWER_LENGTH = 1000;

type ExplainAnswerResult =
  | { status: "unauthorized" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "correct" }
  | RefusedUsage
  | { status: "explained"; explanation: string; explanationId: string; reused: boolean };

/**
 * Explains why a typed or spoken answer to an item or a lesson step is wrong.
 * The explanation is stored by item or step and normalized answer, so the next
 * learner who makes the same mistake gets it at once and no model runs again.
 * An answer that matches an accepted answer has nothing to explain. Only a new
 * explanation is claimed as small AI help (`claimAssist`), since stored ones cost nothing.
 */
export async function explainAnswer({
  answer,
  target,
}: {
  answer: string;
  target: AnswerExplanationTarget;
}): Promise<ExplainAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!normalizeTypedAnswer(answer) || answer.length > MAX_EXPLAINED_ANSWER_LENGTH) {
    return { status: "invalid" };
  }

  const context = await getOpenAnswerContext({ target, userId: session.user.id });

  if (!context) {
    return { status: "notFound" };
  }

  const { language } = context;

  if (matchTypedAnswer({ acceptedAnswers: context.acceptedAnswers, answer }).kind === "exact") {
    return { status: "correct" };
  }

  const stored = await findAnswerExplanation({ answer, language, target });

  if (stored) {
    return {
      explanation: stored.explanation,
      explanationId: stored.id,
      reused: true,
      status: "explained",
    };
  }

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  const { data, provenance } = await explainWrongAnswer({
    analytics: { contentScope: "shared", distinctId: session.user.id },
    answer,
    correctAnswer: context.sampleAnswer,
    keyPoints: context.keyPoints,
    language,
    question: context.context ? `${context.context}\n\n${context.question}` : context.question,
  });

  const saved = await saveAnswerExplanation({
    answer,
    explanation: data.explanation,
    language,
    provenance,
    target,
  });

  return {
    explanation: saved.explanation,
    explanationId: saved.id,
    reused: false,
    status: "explained",
  };
}
