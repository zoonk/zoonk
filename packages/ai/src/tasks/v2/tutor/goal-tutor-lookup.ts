import { tool } from "ai";
import { z } from "zod";
import { isTimeoutError, toDeadlineError } from "../../../evaluate/evaluation-timeout";
import {
  LEARNER_LOOKUPS,
  LEARNER_LOOKUP_USES,
  type LearnerLookUpFound,
} from "./goal-tutor-lookup-learner";
import { PLAN_LOOKUPS, PLAN_LOOKUP_USES, type PlanLookUpFound } from "./goal-tutor-lookup-plan";
import { type GoalTutorLinks, stringifyWithLinks } from "./goal-tutor-pages";

/** Beyond the context, which stays small so every message reads it from the cache. */
const GOAL_TUTOR_LOOKUPS = [
  "noticeTopics",
  "subjectProgress",
  "mocks",
  "lesson",
  "mistakes",
  ...PLAN_LOOKUPS,
  ...LEARNER_LOOKUPS,
] as const;

export type GoalTutorLookUp = (typeof GOAL_TUTOR_LOOKUPS)[number];

export function isPlanLookUp(what: GoalTutorLookUp): what is (typeof PLAN_LOOKUPS)[number] {
  return PLAN_LOOKUPS.some((kind) => kind === what);
}

export function isLearnerLookUp(what: GoalTutorLookUp): what is (typeof LEARNER_LOOKUPS)[number] {
  return LEARNER_LOOKUPS.some((kind) => kind === what);
}

/**
 * A lookup reads the learner's own rows in the database, usually in well under a second; past
 * this, the buddy answers without it.
 */
export const LOOKUP_DEADLINE_MS = 5000;

/**
 * Lookups one message may make, across its steps: enough for two kinds of data and one narrower
 * look after a first result, never a loop over the learner's data.
 */
const MAX_LOOKUPS_PER_MESSAGE = 3;

const MAX_AREA_LENGTH = 120;
const MAX_QUERY_LENGTH = 120;

export type GoalTutorLookUpRequest = {
  /** As the context names it; null for all of them. */
  area: string | null;
  query: string | null;
  what: GoalTutorLookUp;
};

type NoticeTopic = {
  frequency: string | null;
  heading: string | null;
  name: string;
  /** Null once studied, or when it isn't planned. */
  nextDate: string | null;
  notPlannedReason: string | null;
  /** From the plan's lessons on it: studied, known, inProgress, toStudy or notPlanned. */
  status: string | null;
};

type SubjectChapter = { lessonsDone: number; lessonsTotal: number; state: string; title: string };

type GoalTutorLookUpFound =
  | PlanLookUpFound
  | LearnerLookUpFound
  | {
      /** Each subject's questions are in the context's `exam.subjects`, counted as the app shows them. */
      subjects: {
        /** Past the ones shown or the ones `query` matched. */
        moreTopics: number;
        name: string;
        topics: NoticeTopic[];
      }[];
      source: string | null;
      what: "noticeTopics";
    }
  | {
      subjects: {
        /** In the last weeks; null before any. */
        answers: { right: number; total: number } | null;
        chapters: SubjectChapter[];
        lessonsDone: number;
        /** Of `lessonsDone`, the ones a test skipped because the learner showed they know them. */
        lessonsTestedOut: number;
        lessonsTotal: number;
        moreChapters: number;
        name: string;
        nextDate: string | null;
        openMistakes: number;
        topics: number;
        topicsStudied: number | null;
      }[];
      what: "subjectProgress";
    }
  | {
      improved: string[];
      /** Newest first. `estimate` only when the exam's scoring gives a range. */
      mocks: {
        areas: { correct: number; name: string; total: number }[];
        correct: number;
        date: string;
        estimate: { high: number; low: number } | null;
        /** The whole exam (`full`), half of it (`half`) or one subject (`area`, see `subject`). */
        kind: string | null;
        /** For an exam scored right minus wrong (Cebraspe's): that net, of `total`. */
        net: number | null;
        number: number;
        subject: string | null;
        total: number;
      }[];
      needsWork: string[];
      what: "mocks";
    }
  | {
      lessons: {
        canDo: string | null;
        /** Null once done or outside the plan's days. */
        date: string | null;
        description: string;
        done: boolean;
        ideas: string[];
        title: string;
      }[];
      what: "lesson";
    }
  | {
      mistakes: {
        answer: string | null;
        cause: string | null;
        correctAnswer: string | null;
        date: string;
        question: string;
        skill: string | null;
        status: string;
      }[];
      moreMistakes: number;
      what: "mistakes";
    };

/**
 * `notExam`: notice topics are for exams with a notice; `limit`: this message already looked up as
 * much as one may; `timeout` or `error`: it couldn't read it now.
 */
export type GoalTutorLookUpResult =
  | ({ status: "found" } & GoalTutorLookUpFound)
  | { areas?: string[]; moreAreas?: number; status: "notFound"; what: GoalTutorLookUp }
  | {
      reason: "error" | "limit" | "notExam" | "timeout";
      status: "unavailable";
      what: GoalTutorLookUp;
    };

export type LookUpGoalData = (request: GoalTutorLookUpRequest) => Promise<GoalTutorLookUpResult>;

const LOOKUP_USES: Record<GoalTutorLookUp, string> = {
  ...PLAN_LOOKUP_USES,
  ...LEARNER_LOOKUP_USES,
  lesson:
    "a lesson of their plan by its title (`query`): what it teaches (its key ideas), whether they finished it and when it's planned. For what a lesson covers or what comes in it.",
  mistakes:
    "their mistakes beyond the latest few in the context, newest first: the question, their answer, the right one and why they missed it. Narrow it with `area` or `query` (a subject or topic). For mistakes they made earlier or on one subject.",
  mocks:
    "the mock exams they finished: each one's result by subject (an estimated range only when its scoring gives one) and the subjects that got better or still need work. For how their mocks went.",
  noticeTopics:
    "the exam notice's topics by subject, in the notice's words, each with whether their plan studies it and when. Give `query` with a topic's or a law's words (\"Lei 8.112\") to check whether the notice asks it, or `area` for a whole subject. For what the exam asks.",
  subjectProgress:
    "how they're doing by subject (`area` for one): lessons done of the total (some skipped by a test they passed, `lessonsTestedOut`: never say they took those), topics studied, right answers in the last weeks, open mistakes, its chapters and when it comes next. For how they're doing in a subject.",
};

/** The same for every learner, so it stays in the cached start of every request. */
const LOOKUP_DESCRIPTION = [
  `Looks up the learner's own data that CURRENT_CONTEXT doesn't show. Use it only when the answer needs something the context doesn't have, never for what it already shows, and at most ${MAX_LOOKUPS_PER_MESSAGE} times per message. Only you see what it returns: say what matters in your answer, and link what it links.`,
  ...GOAL_TUTOR_LOOKUPS.map((what) => `- ${what}: ${LOOKUP_USES[what]}`),
].join("\n");

/** The deadline's own `TimeoutError`, or what aborted it. */
function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("The lookup was aborted", { cause: reason });
}

/**
 * The AI SDK only signals the tool's `timeout`, so a lookup still running then comes back as
 * `timeout` and the buddy answers without it.
 */
async function lookUpUntilDeadline({
  lookUp,
  request,
  signal,
}: {
  lookUp: LookUpGoalData;
  request: GoalTutorLookUpRequest;
  signal: AbortSignal | undefined;
}): Promise<GoalTutorLookUpResult> {
  const deadline = new Promise<never>((_, reject) => {
    signal?.addEventListener("abort", () => reject(toError(signal.reason)), { once: true });
  });

  try {
    return await Promise.race([lookUp(request), deadline]);
  } catch (error) {
    if (isTimeoutError(toDeadlineError(error))) {
      return { reason: "timeout", status: "unavailable", what: request.what };
    }

    throw error;
  }
}

/** Read-only: its result reaches only the model, never the learner's screen. */
export function createLookUpTool({
  links,
  lookUp,
}: {
  links: GoalTutorLinks;
  lookUp: LookUpGoalData;
}) {
  let lookups = 0;

  return tool({
    description: LOOKUP_DESCRIPTION,
    execute: (request, { abortSignal }): Promise<GoalTutorLookUpResult> => {
      lookups += 1;

      if (lookups > MAX_LOOKUPS_PER_MESSAGE) {
        return Promise.resolve({ reason: "limit", status: "unavailable", what: request.what });
      }

      return lookUpUntilDeadline({ lookUp, request, signal: abortSignal });
    },
    inputSchema: z.object({
      area: z
        .string()
        .max(MAX_AREA_LENGTH)
        .nullable()
        .describe(
          "A subject or area, as setup.areas or exam.subjects names it, to look at that one only; null for all",
        ),
      query: z
        .string()
        .max(MAX_QUERY_LENGTH)
        .nullable()
        .describe(
          "Words to find, in the learner's language: a topic or law of the notice, a lesson's title, a mistake's topic; null for everything",
        ),
      what: z.enum(GOAL_TUTOR_LOOKUPS),
    }),
    toModelOutput: ({ output }) => ({
      type: "text",
      value: stringifyWithLinks(output, links.toLink),
    }),
  });
}
