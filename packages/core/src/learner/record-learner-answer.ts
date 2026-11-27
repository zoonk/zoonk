import "server-only";
import {
  type Attempt,
  type AttemptEvidence,
  type LearnerSkill,
  type Mistake,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { type JsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../cache/tags";
import { fixMistakesAnsweredRight } from "../mistakes/fix-mistakes";
import { type RecordedMistakeSnapshot as MistakeSnapshot } from "../mistakes/mistake-snapshot";
import { recordMistake } from "../mistakes/record-mistake";
import { createLearnerAttempt, writeAttemptAttribution } from "./_utils/create-learner-attempt";
import { type LessonAnswerRun, getLessonAnswerEvidence } from "./_utils/lesson-answer-evidence";
import { markLearnerChanged } from "./_utils/mark-learner-changed";
import { applyAnswerToLearnerSkill, loadSkillSurvivors } from "./_utils/update-learner-skill";
import { type SkillReview, getAnswerEvents } from "./answer-events";
import { type GradedAnswer } from "./answer-rating";
import { loadExamWritingSkillIdsForLearner } from "./writing-skills";

const RECENT_SKILL_ANSWERS = 10;

/** Diagnostics never create notebook mistakes and update memory only when correct or already being learned. */
type LearnerAnswerPurpose = "diagnostic" | "learning";

export type LearnerAnswer = {
  answer: JsonObject;
  answeredAt?: Date;
  /** Reuse the client attempt id across retries to prevent recording the same answer twice. */
  attemptId?: string;
  evidence?: AttemptEvidence | null;
  lessonRun?: LessonAnswerRun;
  focusTestId?: string | null;
  graded: GradedAnswer;
  /** Placement remains diagnostic evidence even when asked inside a session. */
  isPlacement?: boolean;
  itemId?: string | null;
  language: string;
  /** For wrong learning answers: what the notebook keeps and what its cause reads. */
  mistake?: { questionText: string; snapshot: MistakeSnapshot; timeLimitMs?: number | null } | null;
  mockExamId?: string | null;
  /** The notebook entry a practice drill targets; a right answer on a later day fixes it. */
  practicedMistakeId?: string | null;
  practiceQuestion?: { kind: "item" | "lesson"; id: string };
  purpose: LearnerAnswerPurpose;
  skillId?: string | null;
  stepId?: string | null;
  studySessionId?: string | null;
  targetLanguage?: string | null;
  timeZone: string;
  userId: string;
};

export type RecordedLearnerAnswer = {
  attempt: Attempt;
  fixedMistakeIds: string[];
  learnerSkill: LearnerSkill | null;
  mistake: Mistake | null;
};

async function loadSkillHistory({
  skillId,
  transaction,
  userId,
}: {
  skillId: string | null;
  transaction: TransactionClient;
  userId: string;
}) {
  if (!skillId) {
    return { before: null, recent: { correct: 0, total: 0 } };
  }

  const before = await transaction.learnerSkill.findUnique({
    where: { userSkill: { skillId, userId } },
  });

  const answers = await transaction.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { isCorrect: true },
    take: RECENT_SKILL_ANSWERS,
    where: { skillId, userId },
  });

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
  transaction: TransactionClient;
};

function hasUnfinishedDueReview({
  answeredAt,
  before,
  input,
}: Pick<AnswerContext, "answeredAt" | "before" | "input">) {
  if (input.purpose !== "diagnostic" || input.studySessionId || !before?.due || before.reps === 0) {
    return false;
  }

  const today = getDateInTimeZone({ date: answeredAt, timeZone: input.timeZone });
  const dueDay = getDateInTimeZone({ date: before.due, timeZone: input.timeZone });
  const lastReview = before.lastReviewedAt;

  return (
    dueDay <= today &&
    (!lastReview || getDateInTimeZone({ date: lastReview, timeZone: input.timeZone }) < today)
  );
}

async function updateMemory({
  answeredAt,
  before,
  input,
  skillId,
  transaction,
}: AnswerContext): Promise<SkillReview | null> {
  const isUnderway = (before?.reps ?? 0) > 0;
  const updates = input.purpose === "learning" || input.graded.isCorrect || isUnderway;

  if (!skillId || !updates || hasUnfinishedDueReview({ answeredAt, before, input })) {
    return null;
  }

  return applyAnswerToLearnerSkill(
    {
      answer: input.graded,
      learning: input.purpose === "learning",
      reviewedAt: answeredAt,
      skillId,
      timeZone: input.timeZone,
      userId: input.userId,
    },
    transaction,
  );
}

function fixAnsweredMistakes({ answeredAt, input, itemId, stepId, transaction }: AnswerContext) {
  if (!input.graded.isCorrect || input.answer.dontKnow === true) {
    return { fixed: [], replayed: false };
  }

  return fixMistakesAnsweredRight(
    {
      answeredAt,
      itemId,
      practiceQuestion: input.practiceQuestion,
      practicedMistakeId: input.practicedMistakeId,
      questionText: input.mistake?.snapshot.question,
      replay: input.mistake?.snapshot.replay,
      stepId,
      timeZone: input.timeZone,
      userId: input.userId,
    },
    transaction,
  );
}

function addToNotebook({ attemptId, context }: { attemptId: string; context: AnswerContext }) {
  const { answeredAt, before, input, itemId, recent, skillId, stepId, transaction } = context;
  const entry = input.mistake;

  if (input.graded.isCorrect || input.purpose !== "learning" || !entry) {
    return null;
  }

  return recordMistake(
    {
      attemptId,
      itemId,
      language: input.language,
      missedAt: answeredAt,
      practicedMistakeId: input.practicedMistakeId,
      signals: {
        dontKnow: input.answer.dontKnow === true,
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
      targetLanguage: input.targetLanguage,
      userId: input.userId,
    },
    transaction,
  );
}

function getAttemptEvidence({
  answeredAt,
  before,
  input,
  skillId,
  stepId,
  transaction,
}: AnswerContext) {
  if (input.isPlacement || input.purpose === "diagnostic" || input.mockExamId) {
    return null;
  }

  if (input.practicedMistakeId) {
    return "replay";
  }

  if (!input.lessonRun) {
    return input.evidence ?? null;
  }

  if (!skillId || !stepId) {
    return "guided";
  }

  return getLessonAnswerEvidence({
    answeredAt,
    before,
    db: transaction,
    run: input.lessonRun,
    skillId,
    stepId,
    userId: input.userId,
  });
}

/** Internal: callers must authorize the learner and grade the answer before supplying input.userId. */
export async function persistLearnerAnswer({
  input,
  transaction,
}: {
  input: LearnerAnswer;
  transaction: TransactionClient;
}) {
  const skillId = input.skillId
    ? (await loadSkillSurvivors([input.skillId], transaction))(input.skillId)
    : null;

  const history = await loadSkillHistory({ skillId, transaction, userId: input.userId });

  const context: AnswerContext = {
    ...history,
    answeredAt: input.answeredAt ?? new Date(),
    input,
    itemId: input.itemId ?? null,
    skillId,
    stepId: input.stepId ?? null,
    transaction,
  };

  const evidence = await getAttemptEvidence(context);

  const attempt = await createLearnerAttempt({
    answeredAt: context.answeredAt,
    input: { ...input, evidence, itemId: context.itemId, skillId, stepId: context.stepId },
    transaction,
  });

  const written = skillId
    ? await loadExamWritingSkillIdsForLearner({
        skillIds: [skillId],
        tx: transaction,
        userId: input.userId,
      })
    : new Set<string>();

  const review = skillId && written.has(skillId) ? null : await updateMemory(context);
  const { fixed: fixedMistakes, replayed } = await fixAnsweredMistakes(context);
  const notebook = await addToNotebook({ attemptId: attempt.id, context });

  const fixedMistakeIds = fixedMistakes.map(({ id }) => id);

  const recordedAttempt = await writeAttemptAttribution({
    attempt,
    cause: notebook?.cause ?? null,
    fixedMistakeIds,
    replayed: replayed || notebook?.replayed === true,
    transaction,
  });

  const events = getAnswerEvents({
    answeredAt: context.answeredAt,
    fixedMistakes,
    isCorrect: input.graded.isCorrect,
    review,
    timeZone: input.timeZone,
  });

  const result: RecordedLearnerAnswer = {
    attempt: recordedAttempt,
    fixedMistakeIds,
    learnerSkill: review?.after ?? context.before,
    mistake: notebook?.mistake ?? null,
  };

  return { events, recorded: result };
}

/** Publish only after the enclosing transaction commits, so a rollback has no external effects. */
export function publishLearnerAnswer({
  events,
  userId,
}: {
  events: ReturnType<typeof getAnswerEvents>;
  userId: string;
}): void {
  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  if (events.length > 0) {
    after(() => trackLearnerEvents({ events, userId }));
  }
}

/** Commits the answer and notebook changes together; checkpoint writers use their enclosing transaction instead. */
export async function recordLearnerAnswer(input: LearnerAnswer): Promise<RecordedLearnerAnswer> {
  const { events, recorded } = await prisma.$transaction(async (transaction) => {
    await markLearnerChanged(transaction, { planInputs: true, userId: input.userId });
    return persistLearnerAnswer({ input, transaction });
  });

  publishLearnerAnswer({ events, userId: input.userId });

  return recorded;
}
