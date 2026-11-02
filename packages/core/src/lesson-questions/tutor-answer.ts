import "server-only";
import {
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
import { joinStepTexts, streamGoalTutorAnswer } from "@zoonk/ai/tasks/tutor/goal-tutor";
import {
  type GoalTutorAppToolRequest,
  type GoalTutorAppToolResult,
  type GoalTutorPlanChangeResult,
} from "@zoonk/ai/tasks/tutor/goal-tutor-cards";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
} from "@zoonk/ai/tasks/tutor/goal-tutor-lookup";
import { listGoalTutorPages } from "@zoonk/ai/tasks/tutor/goal-tutor-pages";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { keepAllowedMarkdownLinks } from "@zoonk/utils/markdown-links";
import { replaceEmDashes } from "@zoonk/utils/string";
import { type MemoryChange } from "../memory/memory-contract";
import { type PlanChangeView } from "../plans/plan-view-contract";
import { toAppToolResult } from "./_utils/tutor-app-tool-result";
import { isGoalTutorAnswer } from "./_utils/tutor-model";
import { toPlanChangeModelResult } from "./_utils/tutor-plan-change-result";
import {
  type claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  failLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "./answer-lifecycle";
import { type TutorToolOffer } from "./contract";
import { lookUpTutorData } from "./look-up-tutor-data";
import { offerTutorTool } from "./offer-tutor-tool";
import { proposeTutorPlanChange } from "./propose-tutor-plan-change";
import { createAnswerLinks } from "./tutor-app-links";

const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty lesson question answer";

type ClaimedAnswer = Extract<
  Awaited<ReturnType<typeof claimLessonQuestionAnswer>>,
  { status: "ready" }
>["claim"];

type AnswerGeneration =
  | ReturnType<typeof streamGoalTutorAnswer>
  | ReturnType<typeof streamLessonQuestionAnswer>;

type TutorAnswerTarget = { questionId: string; revision: number; shareAnswer: boolean };

export type TutorAnswerRun = {
  answer: AnswerGeneration;
  confirmationLanguage: string | null;
  /** No answer saves an app link nobody checked. */
  keepLinks: (markdown: string) => string;
  offers: TutorToolOffer[];
  proposals: { change: PlanChangeView; replaced: string[] }[];
  target: TutorAnswerTarget;
};

function toTarget(claim: ClaimedAnswer): TutorAnswerTarget {
  return { questionId: claim.questionId, revision: claim.revision, shareAnswer: claim.shareAnswer };
}

function startGoalTutorAnswer(
  claim: ClaimedAnswer & { contextSnapshot: PlanScopeContext },
): TutorAnswerRun {
  const { contextSnapshot } = claim;
  const proposals: TutorAnswerRun["proposals"] = [];
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

  return {
    answer: streamGoalTutorAnswer({
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
    }),
    confirmationLanguage: contextSnapshot.language,
    keepLinks: (markdown) => checkLinks(markdown).markdown,
    offers,
    proposals,
    target: toTarget(claim),
  };
}

const WEB_ADDRESS = /^https?:\/\//iu;

function keepWebLinks(markdown: string): string {
  return keepAllowedMarkdownLinks({ isAllowed: (href) => WEB_ADDRESS.test(href), markdown })
    .markdown;
}

function isStandaloneScreen(
  screen: TutorScreenContext | undefined,
): screen is Exclude<TutorScreenContext, ItemScopeContext | SubjectScopeContext> {
  return screen !== undefined && screen.scope.kind !== "item" && screen.scope.kind !== "subject";
}

function isGoalSnapshot(snapshot: LessonQuestionContextSnapshot): snapshot is PlanScopeContext {
  return snapshot.scope.kind === "plan";
}

function getLessonScreen(snapshot: LessonQuestionContextSnapshot) {
  const screen = isGoalSnapshot(snapshot) ? snapshot.screen : snapshot;

  if (!isStandaloneScreen(screen)) {
    throw new Error("A shared answer needs the lesson screen it's about");
  }

  return screen;
}

export function startTutorAnswer(claim: ClaimedAnswer): TutorAnswerRun {
  if (isGoalTutorAnswer(claim)) {
    return startGoalTutorAnswer(claim);
  }

  return {
    answer: streamLessonQuestionAnswer({
      analytics: { ...claim.analytics, contentScope: claim.shareAnswer ? "shared" : "personal" },
      contextSnapshot: getLessonScreen(claim.contextSnapshot),
      learnerMemory: claim.learnerMemory,
      priorTurns: claim.priorTurns,
      question: claim.question,
    }),
    confirmationLanguage: null,
    keepLinks: keepWebLinks,
    offers: [],
    proposals: [],
    target: toTarget(claim),
  };
}

async function readCompletion({
  confirmation,
  run,
}: {
  confirmation: string | null;
  run: TutorAnswerRun;
}): Promise<{ completion: LessonQuestionAnswerCompletion; confirmation: string | null }> {
  const { generation, provenance } = run.answer;
  const [finalStep, steps] = await Promise.all([generation.finalStep, generation.steps]);

  const failed = finalStep.finishReason === "error";
  const words = joinStepTexts(steps);
  const confirmed = failed || words ? null : confirmation;
  const text = words || confirmed;

  if (failed || !text) {
    throw new Error(EMPTY_ANSWER_MESSAGE);
  }

  const { generatedAt, model, promptVersion, provider, runId } = await provenance;

  return {
    completion: {
      answer: run.keepLinks(text),
      finishReason: finalStep.finishReason,
      generatedAt,
      model,
      promptVersion,
      provider,
      runId,
    },
    confirmation: confirmed,
  };
}

/**
 * Call once the answer's stream has ended. Saves the answer, or marks it failed and throws. The
 * confirmation is saved as the answer only when the model acted without words; it comes back when
 * it was.
 */
export async function finishTutorAnswer({
  confirmation,
  run,
}: {
  confirmation: string | null;
  run: TutorAnswerRun;
}): Promise<{ confirmation: string | null; saved: string }> {
  const { target } = run;

  try {
    const finished = await readCompletion({ confirmation, run });
    const result = await completeLessonQuestionAnswer({ ...finished.completion, ...target });

    if (result.status !== "updated") {
      throw new Error(`Lesson question answer was not persisted: ${result.status}`);
    }

    return {
      confirmation: finished.confirmation,
      saved: replaceEmDashes(finished.completion.answer),
    };
  } catch (error) {
    logError("[Lesson Question Answer Error]", {
      questionId: target.questionId,
      revision: target.revision,
    });

    await failLessonQuestionAnswer({ questionId: target.questionId, revision: target.revision });
    throw error;
  }
}

/** Call after `finishTutorAnswer`: the answer is saved by then, so a failure is logged and changes nothing. */
export async function rememberTutorAnswer(target: TutorAnswerTarget): Promise<MemoryChange[]> {
  if (target.shareAnswer) {
    return [];
  }

  const { data, error } = await safeAsync(() =>
    rememberLessonQuestionAnswer({ questionId: target.questionId }),
  );

  if (error) {
    logError("[Lesson Question Memory Error]", { questionId: target.questionId });
    return [];
  }

  return data;
}
