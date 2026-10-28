import {
  LESSON_QUESTION_MODEL,
  type LessonQuestionAnswerCompletion,
  streamLessonQuestionAnswer,
} from "@zoonk/ai/tasks/lessons/question";
import {
  type ItemScopeContext,
  type LessonQuestionContextSnapshot,
  type PlanScopeContext,
  type SubjectScopeContext,
  type TutorScreenContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { GOAL_TUTOR_MODEL, streamGoalTutorAnswer } from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import {
  type GoalTutorAppToolRequest,
  type GoalTutorAppToolResult,
  type GoalTutorPlanChangeResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-cards";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { listGoalTutorPages } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-pages";
import { type claimLessonQuestionAnswer } from "@zoonk/core/lesson-questions/answer-lifecycle";
import {
  LESSON_QUESTION_PLAN_CHANGE_PART,
  LESSON_QUESTION_REPLACED_CHANGES_PART,
  LESSON_QUESTION_TOOL_OFFER_PART,
  type TutorToolOffer,
} from "@zoonk/core/lesson-questions/contract";
import { lookUpTutorData } from "@zoonk/core/lesson-questions/look-up";
import { offerTutorTool } from "@zoonk/core/lesson-questions/offer-tool";
import { proposeTutorPlanChange } from "@zoonk/core/lesson-questions/propose-plan-change";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { createAnswerLinks } from "@zoonk/player/tutor/app-links";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { keepAllowedMarkdownLinks } from "@zoonk/utils/markdown-links";
import { createEmDashReplacer } from "@zoonk/utils/string";
import { type LanguageModelUsage, type UIMessageChunk, toUIMessageStream } from "ai";
import { toAppToolResult } from "./tutor-app-tool-result";
import { toPlanChangeModelResult } from "./tutor-plan-change-result";

const STEP_BREAK = "\n\n";

export type ClaimedAnswer = Extract<
  Awaited<ReturnType<typeof claimLessonQuestionAnswer>>,
  { status: "ready" }
>["claim"];

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

export type AnswerRun = {
  answer: AnswerGeneration;
  chunks: ReadableStream<UIMessageChunk>;
  /** No answer saves an app link nobody checked. */
  keepLinks: (markdown: string) => string;
  offers: TutorToolOffer[];
  proposals: { change: PlanChangeView; replaced: string[] }[];
};

const PROPOSE_PLAN_CHANGE_TOOL = "proposePlanChange";
const OFFER_APP_TOOL = "offerAppTool";

function startGoalTutorAnswer({
  claim,
  contextSnapshot,
}: {
  claim: ClaimedAnswer;
  contextSnapshot: PlanScopeContext;
}): AnswerRun {
  const proposals: AnswerRun["proposals"] = [];
  const offers: TutorToolOffer[] = [];

  const proposePlanChange = async (request: string): Promise<GoalTutorPlanChangeResult> => {
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

  const offerAppTool = async ({
    area,
    goal,
    tool,
    topic,
  }: GoalTutorAppToolRequest): Promise<GoalTutorAppToolResult> => {
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

  const lookUp = async (request: GoalTutorLookUpRequest): Promise<GoalTutorLookUpResult> => {
    const { data, error } = await safeAsync(() =>
      lookUpTutorData({ ...request, questionId: claim.questionId, revision: claim.revision }),
    );

    if (error) {
      logError("[Goal Tutor Lookup Error]", { questionId: claim.questionId, what: request.what });
    }

    return !data || data.status === "unauthorized"
      ? { reason: "error", status: "unavailable", what: request.what }
      : data;
  };

  const { checkLinks, links } = createAnswerLinks(
    listGoalTutorPages({ selectedGoal: contextSnapshot.selectedGoal === true }),
  );

  const answer = streamGoalTutorAnswer({
    analytics: { ...claim.analytics, contentScope: "personal" },
    contextSnapshot,
    learnerMemory: claim.learnerMemory,
    learnerNames: claim.learnerNames,
    links,
    lookUp,
    offerAppTool,
    priorTurns: claim.priorTurns,
    proposePlanChange,
    question: claim.question,
  });

  return {
    answer,
    chunks: toUIMessageStream({ sendReasoning: false, stream: answer.generation.stream }),
    keepLinks: (markdown) => checkLinks(markdown).markdown,
    offers,
    proposals,
  };
}

const WEB_ADDRESS = /^https?:\/\//iu;

function keepWebLinks(markdown: string): string {
  return keepAllowedMarkdownLinks({ isAllowed: (href) => WEB_ADDRESS.test(href), markdown })
    .markdown;
}

function startLessonQuestionAnswer({
  claim,
  contextSnapshot,
}: {
  claim: ClaimedAnswer;
  contextSnapshot: Exclude<LessonQuestionContextSnapshot, PlanScopeContext>;
}): AnswerRun {
  const answer = streamLessonQuestionAnswer({
    analytics: { ...claim.analytics, contentScope: claim.shareAnswer ? "shared" : "personal" },
    contextSnapshot,
    learnerMemory: claim.learnerMemory,
    priorTurns: claim.priorTurns,
    question: claim.question,
  });

  return {
    answer,
    chunks: toUIMessageStream({ sendReasoning: false, stream: answer.generation.stream }),
    keepLinks: keepWebLinks,
    offers: [],
    proposals: [],
  };
}

function isGoalSnapshot(snapshot: LessonQuestionContextSnapshot): snapshot is PlanScopeContext {
  return snapshot.scope.kind === "plan";
}

function isStandaloneScreen(
  screen: TutorScreenContext | undefined,
): screen is Exclude<TutorScreenContext, ItemScopeContext | SubjectScopeContext> {
  return screen !== undefined && screen.scope.kind !== "item" && screen.scope.kind !== "subject";
}

/** An answer shared by everyone who asks the same thing on a screen never sees the learner's plan. */
export function startTutorAnswer(claim: ClaimedAnswer): AnswerRun {
  const { contextSnapshot } = claim;

  if (isGoalSnapshot(contextSnapshot) && !claim.shareAnswer) {
    return startGoalTutorAnswer({ claim, contextSnapshot });
  }

  const screen = isGoalSnapshot(contextSnapshot) ? contextSnapshot.screen : contextSnapshot;

  if (!isStandaloneScreen(screen)) {
    throw new Error("A shared answer needs the lesson screen it's about");
  }

  return startLessonQuestionAnswer({ claim, contextSnapshot: screen });
}

export function getTutorModel(contextKind: string): string {
  return contextKind === "plan" ? GOAL_TUTOR_MODEL : LESSON_QUESTION_MODEL;
}

type SentParts = { offers: number; proposals: number };

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

export function getAnswerLanguage(snapshot: LessonQuestionContextSnapshot): string | null {
  return isGoalSnapshot(snapshot) ? snapshot.language : null;
}

/**
 * Tool calls stay on the server: only a proposed plan change or an offered app tool reaches the
 * client, as one data part each.
 */
export function toClientChunks(run: AnswerRun) {
  const text = { pendingBreak: false, written: false };
  const toolNames = new Map<string, string>();
  const replacers = new Map<string, ReturnType<typeof createEmDashReplacer>>();
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
        replacers.set(chunk.id, createEmDashReplacer());
      }

      if (chunk.type === "text-delta" && chunk.delta) {
        if (text.pendingBreak) {
          controller.enqueue({ delta: STEP_BREAK, id: chunk.id, type: "text-delta" });
          text.pendingBreak = false;
        }

        text.written = true;
        const delta = replacers.get(chunk.id)?.push(chunk.delta) ?? chunk.delta;

        if (delta) {
          controller.enqueue({ ...chunk, delta });
        }

        return;
      }

      if (chunk.type === "text-end") {
        const rest = replacers.get(chunk.id)?.end();
        replacers.delete(chunk.id);

        if (rest) {
          controller.enqueue({ delta: rest, id: chunk.id, type: "text-delta" });
        }
      }

      controller.enqueue(chunk);
    },
  });
}
