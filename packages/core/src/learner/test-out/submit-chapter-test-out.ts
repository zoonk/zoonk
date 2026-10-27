import "server-only";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { type ChoiceItem, gradeChoiceAnswer, parseChoiceItem } from "../_utils/choice-items";
import { loadTestOutPlan } from "../_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../_utils/known-skills";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../_utils/write-learner-change";
import { type ItemAnswerInput } from "../contract";
import { recordLearnerAnswer } from "../record-learner-answer";
import { getChapterSkills } from "./_utils/chapter-items";
import { isTestOutPlusOnly } from "./_utils/test-out-access";
import {
  type TestOutReceipt,
  findTestOutReceipt,
  toTestOutContentIds,
} from "./_utils/test-out-receipt";
import { type ChapterTestOutInput } from "./test-out-contract";
import { type TestOutScore, scoreTestOut } from "./test-out-rules";

const PERCENT = 100;

type ChapterTestOutOutcome = ProgressCelebration &
  TestOutScore & {
    answers: { isCorrect: boolean; itemId: string }[];
    /** The plan change that skipped the lessons, so the result can offer its undo right there. */
    changeId: string | null;
    /** The lessons it skipped, as the plan change and the Plan count them. */
    lessonsSkipped: number;
  };

export type SubmitChapterTestOutResult =
  | { outcome: ChapterTestOutOutcome; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "plusRequired" }
  | { status: "unauthorized" };

type GradedAnswer = { answer: ItemAnswerInput; isCorrect: boolean; item: ChoiceItem };

/** What the result says, as the ledger row keeps it (`TestOutReceipt`). */
type TestOutSaid = Omit<TestOutReceipt, "chapterId" | "goalId">;

function firstAnswerPerItem(answers: readonly ItemAnswerInput[]): ItemAnswerInput[] {
  return answers.filter(
    (answer, index) => answers.findIndex((other) => other.itemId === answer.itemId) === index,
  );
}

/** Each answer graded; null when one isn't a question about the chapter's skills. */
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

/**
 * Records every answer as diagnostic, so each is evidence for its skill. A chapter of few skills
 * asks each several times: one skill's answers update its memory one after another, so they never
 * race on the same row.
 */
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

/**
 * Adds the test to the learner's day (its time, its answers and the Energy they give) with a
 * ledger row that keeps what its result says, once: under the progress lock a double submit finds
 * the first one's row and gets what it said instead. Statistics and the day's totals show it, so
 * it's a learner change.
 */
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
  said: TestOutSaid;
  timeZone: string;
  userId: string;
}): Promise<{
  progress: { brainPower: ProgressChange; energy: ProgressChange } | null;
  said: TestOutSaid;
}> {
  return writeLearnerChange({ userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
    const earlier = await findTestOutReceipt({ client: tx, requestId, userId });

    if (earlier) {
      return unchanged({ progress: null, said: earlier });
    }

    const progress = await settleAnsweredActivity(tx, {
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

    return { progress, said };
  });
}

/** The result: the answers graded, and the score and plan change as the test recorded them. */
function toReadyResult({
  celebration,
  graded,
  said,
  score,
}: {
  celebration: ProgressCelebration;
  graded: readonly GradedAnswer[];
  said: TestOutSaid;
  score: TestOutScore;
}): SubmitChapterTestOutResult {
  return {
    outcome: {
      ...score,
      ...celebration,
      answers: graded.map(({ isCorrect, item }) => ({ isCorrect, itemId: item.id })),
      changeId: said.changeId,
      correct: said.correct,
      lessonsSkipped: said.lessonsSkipped,
      passed: said.passed,
      total: said.total,
    },
    status: "ready",
  };
}

/**
 * Grades a chapter test-out and records every answer as diagnostic, so each right answer is the
 * evidence for its skill: nothing the test-out didn't ask about is assumed known. Its answering
 * time counts in the learner's day like any other study. Passing tests
 * out the plan items that teach only skills answered right, so the plan skips them. Every answered
 * question must belong to the chapter. Past a free exam plan's first week it comes with Plus. The
 * same test sent again (`requestId`, a retry after a lost response) returns what it recorded,
 * without recording, counting or celebrating anything again.
 */
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

  if (await isTestOutPlusOnly(owned.goal)) {
    return { status: "plusRequired" };
  }

  const plan = await loadTestOutPlan(goalId);
  const chapterSkillIds = getChapterSkills({ chapterId, plan }).map((skill) => skill.id);

  if (chapterSkillIds.length === 0) {
    return { status: "notFound" };
  }

  const graded = await gradeAnswers({
    answers: firstAnswerPerItem(input.answers),
    chapterSkillIds,
  });

  if (!graded) {
    return { status: "invalidItem" };
  }

  const score = scoreTestOut({
    chapterSkillIds,
    results: graded.map(({ isCorrect, item }) => ({ isCorrect, skillId: item.skillId })),
  });

  const { userId } = owned;
  const sent = await findTestOutReceipt({ requestId: input.requestId, userId });

  if (sent) {
    const celebration = await celebrateProgress({ progress: null, userId });
    return toReadyResult({ celebration, graded, said: sent, score });
  }

  const answeredAt = new Date();
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });
  await recordAnswers({ answeredAt, graded, timeZone, userId });

  const testedOut = score.passed
    ? await markPlanItemsTestedOut({
        goalId,
        items: plan.items,
        knownSkillIds: new Set(score.knownSkillIds),
        testedOutAt: answeredAt,
        timeZone,
      })
    : { changeId: null, lessonsSkipped: 0 };

  // Counted last, with what the result says, so a test is counted once even when sent twice.
  const counted = await countTestOut({
    chapterId,
    goalId,
    graded,
    requestId: input.requestId,
    said: {
      changeId: testedOut.changeId,
      correct: score.correct,
      lessonsSkipped: testedOut.lessonsSkipped,
      passed: score.passed,
      total: score.total,
    },
    timeZone,
    userId,
  });

  const celebration = await celebrateProgress({ progress: counted.progress, userId });
  revalidateCacheTags([getLearnerModelCacheTag(userId), getUserProgressCacheTag(userId)]);

  if (counted.progress) {
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
  }

  return toReadyResult({ celebration, graded, said: counted.said, score });
}
