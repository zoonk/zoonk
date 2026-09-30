import "server-only";
import { type Attempt, type LearnerSkill, type Mistake, prisma } from "@zoonk/db";
import { type JsonObject } from "@zoonk/utils/json";
import { after } from "next/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../cache/tags";
import { fixMistakesAnsweredRight } from "../mistakes/fix-mistakes";
import { type MistakeSnapshot } from "../mistakes/mistake-snapshot";
import { type MistakeCauseRequest, recordMistake } from "../mistakes/record-mistake";
import { getLocalAnswerTime } from "./_utils/local-time";
import { applyAnswerToLearnerSkill, loadSkillSurvivors } from "./_utils/update-learner-skill";
import { type SkillReview, getAnswerEvents } from "./answer-events";
import { type GradedAnswer } from "./answer-rating";

/** How many earlier answers on the skill the mistake cause looks at. */
const RECENT_SKILL_ANSWERS = 10;

/**
 * `learning` answers (lessons, reviews, practice, mocks) update memory and fill the mistakes
 * notebook. `diagnostic` answers (placement, test-outs) measure what the learner already knows: a
 * right one counts as a review, a wrong one only when the skill is already being learned, and
 * neither is a mistake, since nobody taught the skill yet.
 */
type LearnerAnswerPurpose = "diagnostic" | "learning";

export type LearnerAnswer = {
  /** The learner's raw answer, stored on the attempt. */
  answer: JsonObject;
  answeredAt?: Date;
  graded: GradedAnswer;
  itemId?: string | null;
  /** The question's language, for the cause classifier. */
  language: string;
  /** For wrong learning answers: what the notebook keeps and what its cause reads. */
  mistake?: { questionText: string; snapshot: MistakeSnapshot; timeLimitMs?: number | null } | null;
  /** The mock the answer was given in: each of its questions is recorded once. */
  mockExamId?: string | null;
  /** The notebook entry a practice drill targets; a right answer on a later day fixes it. */
  practicedMistakeId?: string | null;
  purpose: LearnerAnswerPurpose;
  skillId?: string | null;
  stepId?: string | null;
  studySessionId?: string | null;
  /**
   * The language practiced, for answers in a language lesson or review. Stored on the attempt so
   * language stats (minutes spoken per language) never read content.
   */
  targetLanguage?: string | null;
  timeZone: string;
  userId: string;
};

export type RecordedLearnerAnswer = {
  attempt: Attempt;
  /** Pass to `scheduleMistakeCause` so an ambiguous cause is classified after the response. */
  causeRequest: MistakeCauseRequest | null;
  fixedMistakeIds: string[];
  learnerSkill: LearnerSkill | null;
  mistake: Mistake | null;
};

async function loadSkillHistory({ skillId, userId }: { skillId: string | null; userId: string }) {
  if (!skillId) {
    return { before: null, recent: { correct: 0, total: 0 } };
  }

  const [before, answers] = await Promise.all([
    prisma.learnerSkill.findUnique({ where: { userSkill: { skillId, userId } } }),
    prisma.attempt.findMany({
      orderBy: { answeredAt: "desc" },
      select: { isCorrect: true },
      take: RECENT_SKILL_ANSWERS,
      where: { skillId, userId },
    }),
  ]);

  return {
    before,
    recent: { correct: answers.filter((answer) => answer.isCorrect).length, total: answers.length },
  };
}

type AnswerContext = {
  answeredAt: Date;
  before: LearnerSkill | null;
  input: LearnerAnswer;
  itemId: string | null;
  recent: { correct: number; total: number };
  skillId: string | null;
  stepId: string | null;
};

function createAttempt({ answeredAt, input, itemId, skillId, stepId }: AnswerContext) {
  return prisma.attempt.create({
    data: {
      answer: input.answer,
      answeredAt,
      durationMs: input.graded.durationMs,
      isCorrect: input.graded.isCorrect,
      itemId,
      mockExamId: input.mockExamId ?? null,
      score: input.graded.score ?? null,
      skillId,
      stepId,
      studySessionId: input.studySessionId ?? null,
      targetLanguage: input.targetLanguage ?? null,
      userId: input.userId,
      ...getLocalAnswerTime({ date: answeredAt, timeZone: input.timeZone }),
    },
  });
}

/** See `LearnerAnswerPurpose`: diagnostics only review skills they confirm or that are underway. */
async function updateMemory({
  answeredAt,
  before,
  input,
  skillId,
}: AnswerContext): Promise<SkillReview | null> {
  const isUnderway = (before?.reps ?? 0) > 0;
  const updates = input.purpose === "learning" || input.graded.isCorrect || isUnderway;

  if (!skillId || !updates) {
    return null;
  }

  return applyAnswerToLearnerSkill({
    answer: input.graded,
    learning: input.purpose === "learning",
    reviewedAt: answeredAt,
    skillId,
    timeZone: input.timeZone,
    userId: input.userId,
  });
}

function fixAnsweredMistakes({ answeredAt, input, itemId, stepId }: AnswerContext) {
  if (!input.graded.isCorrect) {
    return [];
  }

  return fixMistakesAnsweredRight({
    answeredAt,
    itemId,
    practicedMistakeId: input.practicedMistakeId,
    stepId,
    timeZone: input.timeZone,
    userId: input.userId,
  });
}

function addToNotebook({ attemptId, context }: { attemptId: string; context: AnswerContext }) {
  const { before, input, itemId, recent, skillId, stepId } = context;
  const entry = input.mistake;

  if (input.graded.isCorrect || input.purpose !== "learning" || !entry) {
    return null;
  }

  return recordMistake({
    attemptId,
    itemId,
    language: input.language,
    signals: {
      durationMs: input.graded.durationMs,
      misconception: entry.snapshot.misconception,
      questionText: entry.questionText,
      recentSkillAnswers: recent,
      skillState: before?.state ?? "new",
      timeLimitMs: entry.timeLimitMs,
    },
    skillId,
    snapshot: entry.snapshot,
    stepId,
    userId: input.userId,
  });
}

/**
 * Records one graded answer in the learner model: the attempt on the learner's local day, the
 * FSRS review of its skill, fixes for notebook entries it answers right on a later day, and a new
 * notebook entry for a wrong learning answer. The outcomes (a spaced review, a skill changing state,
 * a mistake fixed) go to analytics after the response. Internal: public capabilities grade the
 * answer and derive `userId` from the session first.
 */
export async function recordLearnerAnswer(input: LearnerAnswer): Promise<RecordedLearnerAnswer> {
  const skillId = input.skillId ? (await loadSkillSurvivors([input.skillId]))(input.skillId) : null;
  const history = await loadSkillHistory({ skillId, userId: input.userId });

  const context: AnswerContext = {
    ...history,
    answeredAt: input.answeredAt ?? new Date(),
    input,
    itemId: input.itemId ?? null,
    skillId,
    stepId: input.stepId ?? null,
  };

  const attempt = await createAttempt(context);

  const [review, fixedMistakes, recorded] = await Promise.all([
    updateMemory(context),
    fixAnsweredMistakes(context),
    addToNotebook({ attemptId: attempt.id, context }),
  ]);

  revalidateCacheTags([getLearnerModelCacheTag(input.userId)]);

  const events = getAnswerEvents({
    answeredAt: context.answeredAt,
    fixedMistakes,
    isCorrect: input.graded.isCorrect,
    review,
    timeZone: input.timeZone,
  });

  if (events.length > 0) {
    after(() => trackLearnerEvents({ events, userId: input.userId }));
  }

  return {
    attempt,
    causeRequest: recorded?.causeRequest ?? null,
    fixedMistakeIds: fixedMistakes.map((mistake) => mistake.id),
    learnerSkill: review?.after ?? context.before,
    mistake: recorded?.mistake ?? null,
  };
}
