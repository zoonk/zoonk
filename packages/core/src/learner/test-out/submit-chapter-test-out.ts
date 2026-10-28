import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { type ChoiceItem, gradeChoiceAnswer, parseChoiceItem } from "../_utils/choice-items";
import { markPlanItemsTestedOut } from "../_utils/known-skills";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { writeLearnerChange } from "../_utils/write-learner-change";
import { type ItemAnswerInput } from "../contract";
import { recordLearnerAnswer } from "../record-learner-answer";
import { countSkippableItems, getChapterSkills } from "./_utils/chapter-items";
import { isTestOutPlusOnly } from "./_utils/test-out-access";
import { loadTestOutPlan } from "./_utils/test-out-plan";
import {
  type TestOutReceipt,
  findTestOutReceipt,
  toTestOutContentIds,
} from "./_utils/test-out-receipt";
import { type ChapterTestOutInput } from "./test-out-contract";
import { scoreTestOut } from "./test-out-rules";

const PERCENT = 100;
/** Namespaces the per-test submit lock so it never collides with other advisory locks. */
const SUBMIT_LOCK_NAMESPACE = 51_884;
const SUBMIT_TIMEOUT_MS = 300_000;

type ChapterTestOutOutcome = ProgressCelebration & {
  changeId: string | null;
  correct: number;
  lessonsSkipped: number;
  passed: boolean;
  total: number;
};

export type SubmitChapterTestOutResult =
  | { outcome: ChapterTestOutOutcome; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "nothingToSkip" }
  | { status: "plusRequired" }
  | { status: "unauthorized" };

type GradedAnswer = { answer: ItemAnswerInput; isCorrect: boolean; item: ChoiceItem };

function firstAnswerPerItem(answers: readonly ItemAnswerInput[]): ItemAnswerInput[] {
  return answers.filter(
    (answer, index) => answers.findIndex((other) => other.itemId === answer.itemId) === index,
  );
}

async function gradeAnswers({
  answers,
  chapterSkillIds,
}: {
  answers: readonly ItemAnswerInput[];
  chapterSkillIds: readonly string[];
}): Promise<GradedAnswer[] | null> {
  const rows = await prisma.item.findMany({
    where: { id: { in: answers.map((answer) => answer.itemId) } },
  });

  const graded = answers.map((answer) => {
    const row = rows.find((candidate) => candidate.id === answer.itemId);
    const item = row && chapterSkillIds.includes(row.skillId) ? parseChoiceItem(row) : null;

    return item
      ? { answer, isCorrect: gradeChoiceAnswer({ answer: answer.answer, item }).isCorrect, item }
      : null;
  });

  return graded.every((entry) => entry !== null) ? graded : null;
}

/** Record answers on the same skill sequentially so their memory updates cannot race. */
async function recordAnswers({
  answeredAt,
  graded,
  timeZone,
  userId,
}: {
  answeredAt: Date;
  graded: readonly GradedAnswer[];
  timeZone: string;
  userId: string;
}): Promise<void> {
  const record = ({ answer, isCorrect, item }: GradedAnswer) =>
    recordLearnerAnswer({
      answer: answer.answer,
      answeredAt,
      graded: { durationMs: answer.durationMs, isCorrect },
      itemId: item.id,
      language: item.language,
      purpose: "diagnostic",
      skillId: item.skillId,
      timeZone,
      userId,
    });

  await Promise.all(
    [...Map.groupBy(graded, (entry) => entry.item.skillId).values()].map((answers) =>
      answers.reduce<Promise<unknown>>(
        (previous, entry) => previous.then(() => record(entry)),
        Promise.resolve(),
      ),
    ),
  );
}

function countTestOut({
  chapterId,
  goalId,
  graded,
  requestId,
  said,
  timeZone,
  userId,
}: {
  chapterId: string;
  goalId: string;
  graded: readonly GradedAnswer[];
  requestId: string;
  said: TestOutReceipt;
  timeZone: string;
  userId: string;
}): Promise<{ brainPower: ProgressChange; energy: ProgressChange }> {
  return writeLearnerChange({ userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

    return settleAnsweredActivity(tx, {
      answers: graded.map(({ answer, isCorrect }) => ({
        durationMs: answer.durationMs,
        isCorrect,
      })),
      contentIds: toTestOutContentIds({ ...said, chapterId, requestId }),
      goalId,
      lessonKind: "testOut",
      lock,
      timeZone,
      userId,
    });
  });
}

function toReadyResult({
  celebration,
  said,
}: {
  celebration: ProgressCelebration;
  said: TestOutReceipt;
}): SubmitChapterTestOutResult {
  return {
    outcome: {
      ...celebration,
      changeId: said.changeId,
      correct: said.correct,
      lessonsSkipped: said.lessonsSkipped,
      passed: said.passed,
      total: said.total,
    },
    status: "ready",
  };
}

async function submitOwnedTestOut({
  chapterId,
  goal,
  input,
  userId,
}: {
  chapterId: string;
  goal: Goal;
  input: ChapterTestOutInput;
  userId: string;
}): Promise<SubmitChapterTestOutResult> {
  const goalId = goal.id;

  // Retries must return their receipt even if current grading or eligibility checks would refuse them.
  const sent = await findTestOutReceipt({ chapterId, goalId, requestId: input.requestId, userId });

  if (sent) {
    const celebration = await celebrateProgress({ progress: null, userId });
    return toReadyResult({ celebration, said: sent });
  }

  const plan = await loadTestOutPlan(goalId);
  const chapterSkills = getChapterSkills({ chapterId, plan });

  if (chapterSkills.length === 0) {
    return { status: "notFound" };
  }

  if (countSkippableItems({ plan, skills: chapterSkills }) === 0) {
    return { status: "nothingToSkip" };
  }

  if (await isTestOutPlusOnly(goal)) {
    return { status: "plusRequired" };
  }

  const graded = await gradeAnswers({
    answers: firstAnswerPerItem(input.answers),
    chapterSkillIds: chapterSkills.map((skill) => skill.id),
  });

  if (!graded) {
    return { status: "invalidItem" };
  }

  const score = scoreTestOut({
    chapterSkillIds: chapterSkills.map((skill) => skill.id),
    results: graded.map(({ isCorrect, item }) => ({ isCorrect, skillId: item.skillId })),
  });

  const answeredAt = new Date();
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  await recordAnswers({ answeredAt, graded, timeZone, userId });

  const testedOut = score.passed
    ? await markPlanItemsTestedOut({
        goalId,
        items: plan.items,
        knownSkillIds: new Set(score.knownSkillIds),
        testedOutAt: answeredAt,
        timeZone,
      })
    : await refreshGoalPlan({ goalId }).then(() => ({
        changeId: null,
        lessonsSkipped: 0,
        planVersion: null,
      }));

  const said = {
    changeId: testedOut.changeId,
    correct: score.correct,
    lessonsSkipped: testedOut.lessonsSkipped,
    passed: score.passed,
    planVersion: testedOut.planVersion,
    total: score.total,
  };

  const progress = await countTestOut({
    chapterId,
    goalId,
    graded,
    requestId: input.requestId,
    said,
    timeZone,
    userId,
  });

  const celebration = await celebrateProgress({ progress, userId });
  revalidateCacheTags([getLearnerModelCacheTag(userId), getUserProgressCacheTag(userId)]);

  after(() =>
    trackLearnerEvents({
      events: [
        {
          name: "Test-out Taken",
          properties: {
            chapter_id: chapterId,
            passed: score.passed,
            score: score.total > 0 ? Math.round((score.correct / score.total) * PERCENT) : 0,
          },
        },
      ],
      goalId,
      userId,
    }),
  );

  return toReadyResult({ celebration, said });
}

/** Every question must belong to the chapter. Retrying a requestId returns its receipt without recording or celebrating again. */
export async function submitChapterTestOut({
  chapterId,
  goalId,
  input,
}: {
  chapterId: string;
  goalId: string;
  input: ChapterTestOutInput;
}): Promise<SubmitChapterTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const key = `${owned.userId}:${goalId}:${chapterId}:${input.requestId}`;

  // Domain writers commit their own transactions; this transaction holds only the per-test advisory lock.
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(${SUBMIT_LOCK_NAMESPACE}::int, hashtext(${key}))::text
      `;

      return submitOwnedTestOut({ chapterId, goal: owned.goal, input, userId: owned.userId });
    },
    { timeout: SUBMIT_TIMEOUT_MS },
  );
}
