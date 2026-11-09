import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { collectJsonStrings } from "@zoonk/utils/json";
import { logError } from "@zoonk/utils/logger";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { JEV_MODEL_ID } from "../../evaluate/evaluation-models";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type TutorScreenContext } from "../lessons/lesson-question-context";
import instructions from "./goal-tutor-search.prompt.md";

/**
 * On 8 cases (8 Nov 2026), Decider Flash V1.2 matched Jev on every one (EN 3/3, PT 5/5) at $0.0070
 * against $0.0385 per 1k, in 0.29 s p50 and 0.50 s p95 under shared load.
 */
const EVALUATION_MODEL = "perplexity/pplx-decider-flash-v1.2";
const THRESHOLD = 0.5;

/**
 * A decision slower than this leaves the search to the buddy's own judgment, so a slow or failing
 * classifier never holds the answer back.
 */
const DECISION_DEADLINE_MS = 2500;

/** Where the screen sits and what it shows, so a message pointing at it reads in its subject. */
function screenLines(screen: TutorScreenContext): (string | null)[] {
  if ("lessonSteps" in screen) {
    const place = [screen.course.title, screen.chapter.title, screen.lesson.title];
    return [place.filter(Boolean).join(" › "), ...collectJsonStrings(screen.step?.content)];
  }

  if ("lessons" in screen) {
    return [[screen.course?.title, screen.chapter.title].filter(Boolean).join(" › ")];
  }

  if ("subject" in screen) {
    return [screen.subject.name];
  }

  if ("question" in screen) {
    return [screen.skill, screen.question.text];
  }

  return [screen.exam.name];
}

function describeScreen(screen: TutorScreenContext | undefined): string {
  const lines = screen ? screenLines(screen).filter(Boolean) : [];
  return lines.length > 0 ? lines.join("\n") : "none";
}

export const goalTutorSearchClassifier = {
  question: {
    criteria: {
      false:
        "Stable knowledge (concepts, language, math, science, history, study skills) or a question about the learner's own plan or the app.",
      true: "Answering it right depends on current law, court rulings, official or exam rules, figures or other facts that change.",
    },
    instructions,
    type: "boolean",
  } as const,
  toInput: ({
    earlierQuestion,
    goal,
    question,
    screen,
  }: {
    earlierQuestion: string | null;
    goal: string;
    question: string;
    screen: TutorScreenContext | undefined;
  }) => ({
    EARLIER_MESSAGE: earlierQuestion ?? "none",
    GOAL: goal,
    MESSAGE: question,
    SCREEN: describeScreen(screen),
  }),
};

type SearchDecisionInput = Parameters<typeof goalTutorSearchClassifier.toInput>[0] & {
  analytics?: AiGenerationContext;
};

async function decideSearch({ analytics, ...input }: SearchDecisionInput): Promise<boolean> {
  const { answers } = await evaluateQuestions({
    analytics,
    fallbackModel: JEV_MODEL_ID,
    input: goalTutorSearchClassifier.toInput(input),
    // The question and its screen are saved in the learner's conversation anyway.
    keepInput: true,
    model: EVALUATION_MODEL,
    questions: { needsCurrentSource: goalTutorSearchClassifier.question },
    task: "goal-tutor-search",
  });

  return decideBoolean({
    probability: answers.needsCurrentSource.probability,
    threshold: THRESHOLD,
  });
}

function waitForDeadline(): Promise<false> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(false), DECISION_DEADLINE_MS);
  });
}

/**
 * The model's own judgment skipped searches on law a court had changed (the STF's ADI 1194), so a
 * separate classifier decides. False when it fails or runs late: the buddy can still search.
 */
export async function shouldSearchFirst(input: SearchDecisionInput): Promise<boolean> {
  const { data, error } = await safeAsync(() =>
    Promise.race([decideSearch(input), waitForDeadline()]),
  );

  if (error) {
    logError("[Goal Tutor Search Decision Error]", error);
    return false;
  }

  return data;
}
