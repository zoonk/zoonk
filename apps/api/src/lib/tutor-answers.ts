import {
  LESSON_QUESTION_MODEL,
  type LessonQuestionAnswerCompletion,
  streamLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import {
  type LessonQuestionContextSnapshot,
  type PlanScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import {
  GOAL_TUTOR_MODEL,
  type GoalTutorAppToolRequest,
  type GoalTutorAppToolResult,
  type GoalTutorPlanChangeResult,
  streamGoalTutorAnswer,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import { type claimLessonQuestionAnswer } from "@zoonk/core/lesson-questions/answer-lifecycle";
import {
  LESSON_QUESTION_PLAN_CHANGE_PART,
  LESSON_QUESTION_REPLACED_CHANGES_PART,
  LESSON_QUESTION_TOOL_OFFER_PART,
  type TutorToolOffer,
} from "@zoonk/core/lesson-questions/contract";
import { offerTutorTool } from "@zoonk/core/lesson-questions/offer-tool";
import { proposeTutorPlanChange } from "@zoonk/core/lesson-questions/propose-plan-change";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type LanguageModelUsage, type UIMessageChunk, toUIMessageStream } from "ai";
import { toAppToolResult } from "./tutor-app-tool-result";
import { toPlanChangeModelResult } from "./tutor-plan-change-result";

/**
 * The tutor's answers as the answers route streams them: a lesson's, chapter's or mock's from the
 * lesson tutor, and a goal's from the buddy, which may propose a plan change while it answers.
 */

/** The words of one step after another's: a paragraph break, as the saved answer joins them. */
const STEP_BREAK = "\n\n";

export type ClaimedAnswer = Extract<
  Awaited<ReturnType<typeof claimLessonQuestionAnswer>>,
  { status: "ready" }
>["claim"];

/**
 * What every tutor task streams, read by shape: a lesson's answer is one step; the buddy's may
 * propose a plan change in a first step and answer in a second.
 */
export type AnswerGeneration = {
  generation: {
    finalStep: PromiseLike<{ finishReason: string; text: string }>;
    steps: PromiseLike<readonly { text: string }[]>;
    usage: PromiseLike<LanguageModelUsage>;
  };
  provenance: Promise<
    Pick<
      LessonQuestionAnswerCompletion,
      "generatedAt" | "model" | "promptVersion" | "provider" | "runId"
    >
  >;
};

/**
 * A tutor answer on its way: its UI message chunks, and what its tools did, in order: the plan
 * changes it proposed and the app tools it offered.
 */
export type AnswerRun = {
  answer: AnswerGeneration;
  chunks: ReadableStream<UIMessageChunk>;
  offers: TutorToolOffer[];
  /** Each plan change proposed, with the earlier proposals it replaced. */
  proposals: { change: PlanChangeView; replaced: string[] }[];
};

/** The tools whose output reaches the client as a data part, by the name the model calls them. */
const PROPOSE_PLAN_CHANGE_TOOL = "proposePlanChange";
const OFFER_APP_TOOL = "offerAppTool";

/**
 * The buddy's answer in a goal's conversation. A plan change it asks for is saved as a proposal
 * tied to this answer, and an app tool it offers is saved with the answer; the stream sends each
 * as soon as it's ready.
 */
function startGoalTutorAnswer({
  claim,
  contextSnapshot,
}: {
  claim: ClaimedAnswer;
  contextSnapshot: PlanScopeContext;
}): AnswerRun {
  const proposals: AnswerRun["proposals"] = [];
  const offers: TutorToolOffer[] = [];

  /** One card per message: a plan change's or a feature's, whichever the answer showed first. */
  const hasCard = () => proposals.length > 0 || offers.length > 0;

  const proposeOnce = async (request: string): Promise<GoalTutorPlanChangeResult> => {
    if (hasCard()) {
      return { reason: "onePerMessage", status: "notPossible" };
    }

    const { data, error } = await safeAsync(() =>
      proposeTutorPlanChange({ questionId: claim.questionId, request, revision: claim.revision }),
    );

    if (error) {
      logError("[Goal Tutor Plan Change Error]", { questionId: claim.questionId });
      return { reason: "error", status: "notPossible" };
    }

    if (data.status === "proposed") {
      proposals.push({ change: data.change, replaced: data.replaced });
    }

    return toPlanChangeModelResult(data);
  };

  const offerOnce = async ({
    area,
    goal,
    tool,
    topic,
  }: GoalTutorAppToolRequest): Promise<GoalTutorAppToolResult> => {
    if (hasCard()) {
      return { reason: "onePerMessage", status: "unavailable", tool };
    }

    const { data, error } = await safeAsync(() =>
      offerTutorTool({
        area,
        goalWords: goal,
        questionId: claim.questionId,
        revision: claim.revision,
        tool,
        topic,
      }),
    );

    if (error) {
      logError("[Goal Tutor App Tool Error]", { questionId: claim.questionId });
      return { reason: "unavailable", status: "unavailable", tool };
    }

    if (data.status === "offered") {
      offers.push(data.offer);
    }

    return toAppToolResult({ result: data, tool });
  };

  // Calls in one step run together; one after another through one queue, a later call sees the
  // card an earlier one showed, so two calls in the same step never both show one. Neither
  // rejects (errors become `notPossible` or `unavailable`), so the queue never breaks.
  const cardQueue: { last: Promise<unknown> } = { last: Promise.resolve() };

  const inTurn = <T>(call: () => Promise<T>): Promise<T> => {
    const result = cardQueue.last.then(call);
    cardQueue.last = result;
    return result;
  };

  const proposePlanChange = (request: string) => inTurn(() => proposeOnce(request));

  const offerAppTool = (request: GoalTutorAppToolRequest) => inTurn(() => offerOnce(request));

  const answer = streamGoalTutorAnswer({
    analytics: { ...claim.analytics, contentScope: "personal" },
    contextSnapshot,
    learnerMemory: claim.learnerMemory,
    offerAppTool,
    priorTurns: claim.priorTurns,
    proposePlanChange,
    question: claim.question,
  });

  return {
    answer,
    chunks: toUIMessageStream({ sendReasoning: false, stream: answer.generation.stream }),
    offers,
    proposals,
  };
}

function startLessonQuestionAnswer(claim: ClaimedAnswer): AnswerRun {
  const answer = streamLessonQuestionAnswer({
    analytics: { ...claim.analytics, contentScope: claim.shareAnswer ? "shared" : "personal" },
    contextSnapshot: claim.contextSnapshot,
    learnerMemory: claim.learnerMemory,
    priorTurns: claim.priorTurns,
    question: claim.question,
  });

  return {
    answer,
    chunks: toUIMessageStream({ sendReasoning: false, stream: answer.generation.stream }),
    offers: [],
    proposals: [],
  };
}

function isGoalSnapshot(snapshot: LessonQuestionContextSnapshot): snapshot is PlanScopeContext {
  return snapshot.scope.kind === "plan";
}

/** A goal's questions go to the buddy as the goal's tutor; everything else to the lesson tutor. */
export function startTutorAnswer(claim: ClaimedAnswer): AnswerRun {
  const { contextSnapshot } = claim;

  return isGoalSnapshot(contextSnapshot)
    ? startGoalTutorAnswer({ claim, contextSnapshot })
    : startLessonQuestionAnswer(claim);
}

export function getTutorModel(contextKind: string): string {
  return contextKind === "plan" ? GOAL_TUTOR_MODEL : LESSON_QUESTION_MODEL;
}

/** How many of the run's proposals and offers already reached the client. */
type SentParts = { offers: number; proposals: number };

/**
 * The data parts a tool's output becomes on the client: a plan change (then the earlier proposals
 * it replaced, if any) or an app tool.
 */
function toToolParts({
  run,
  sent,
  toolName,
}: {
  run: AnswerRun;
  sent: SentParts;
  toolName: string | undefined;
}): UIMessageChunk[] {
  if (toolName === PROPOSE_PLAN_CHANGE_TOOL) {
    const proposal = run.proposals[sent.proposals];

    if (!proposal) {
      return [];
    }

    sent.proposals += 1;

    const replaced: UIMessageChunk = {
      data: { ids: proposal.replaced },
      type: LESSON_QUESTION_REPLACED_CHANGES_PART,
    };

    return [
      { data: proposal.change, type: LESSON_QUESTION_PLAN_CHANGE_PART },
      ...(proposal.replaced.length > 0 ? [replaced] : []),
    ];
  }

  if (toolName === OFFER_APP_TOOL) {
    const offer = run.offers[sent.offers];
    sent.offers += offer ? 1 : 0;
    return offer ? [{ data: offer, type: LESSON_QUESTION_TOOL_OFFER_PART }] : [];
  }

  return [];
}

/** The conversation's language: a goal's plan names it; a lesson's answers need no words of ours. */
export function getAnswerLanguage(snapshot: LessonQuestionContextSnapshot): string | null {
  return isGoalSnapshot(snapshot) ? snapshot.language : null;
}

/**
 * Tool calls stay on the server: a proposed plan change and an offered app tool reach the client
 * as one data part each (a search's results don't), and the words of each step read as one
 * answer, a paragraph apart.
 */
export function toClientChunks(run: AnswerRun) {
  const text = { pendingBreak: false, written: false };
  const toolNames = new Map<string, string>();
  const sent: SentParts = { offers: 0, proposals: 0 };

  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === "tool-input-available") {
        toolNames.set(chunk.toolCallId, chunk.toolName);
        return;
      }

      if (chunk.type === "tool-output-available") {
        toToolParts({ run, sent, toolName: toolNames.get(chunk.toolCallId) }).forEach((part) =>
          controller.enqueue(part),
        );

        return;
      }

      if (chunk.type.startsWith("tool-")) {
        return;
      }

      if (chunk.type === "text-start") {
        text.pendingBreak = text.written;
      }

      if (chunk.type === "text-delta" && chunk.delta) {
        if (text.pendingBreak) {
          controller.enqueue({ delta: STEP_BREAK, id: chunk.id, type: "text-delta" });
          text.pendingBreak = false;
        }

        text.written = true;
      }

      controller.enqueue(chunk);
    },
  });
}
