import "server-only";
import { type Goal } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { celebrateProgress } from "../../milestones/celebrate-progress";
import { type FinishedChapter } from "../../sessions/completion-contract";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { findOwnedGoal } from "../_utils/owned-goal";
import { withTestSubmissionClaim } from "../_utils/test-submission-claim";
import { publishLearnerAnswer } from "../record-learner-answer";
import { finishTestOutPlans } from "./_utils/finish-test-out-plans";
import { recordTestOut } from "./_utils/record-test-out";
import {
  type TestOutReceipt,
  findTestOutReceipt,
  readTestOutReceipt,
} from "./_utils/test-out-receipt";
import { type ChapterTestOutInput } from "./test-out-contract";

const PERCENT = 100;

type ChapterTestOutOutcome = ProgressCelebration & {
  changeId: string | null;
  correct: number;
  finishedChapter: FinishedChapter | null;
  lessonsSkipped: number;
  passed: boolean;
  total: number;
};

export type SubmitChapterTestOutResult =
  | { outcome: ChapterTestOutOutcome; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "nothingToSkip" }
  | { status: "unauthorized" };

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
      finishedChapter: said.finishedChapter,
      lessonsSkipped: said.lessonsSkipped,
      passed: said.passed,
      total: said.total,
    },
    status: "ready",
  };
}

/** Retries return their receipt even if current grading or eligibility checks would refuse them. */
async function replaySavedReceipt({
  chapterId,
  goalId,
  requestId,
  userId,
}: {
  chapterId: string;
  goalId: string;
  requestId: string;
  userId: string;
}): Promise<SubmitChapterTestOutResult | null> {
  const sent = await findTestOutReceipt({ chapterId, goalId, requestId, userId });

  if (!sent) {
    return null;
  }

  const celebration = await celebrateProgress({ progress: null, userId });
  return toReadyResult({ celebration, said: sent });
}

async function submitOwnedTestOut({
  chapterId,
  goal,
  input,
}: {
  chapterId: string;
  goal: Goal;
  input: ChapterTestOutInput;
}): Promise<SubmitChapterTestOutResult> {
  const { id: goalId, userId } = goal;

  const saved = await recordTestOut({ chapterId, goal, input });

  if (saved.status !== "ready") {
    return saved;
  }

  const { events, progress } = saved;

  if (progress) {
    publishLearnerAnswer({ events, userId });
  }

  const said = await readTestOutReceipt(await finishTestOutPlans(saved.event));
  const celebration = await celebrateProgress({ progress, userId });
  revalidateCacheTags([getLearnerModelCacheTag(userId), getUserProgressCacheTag(userId)]);

  if (progress) {
    after(() =>
      trackLearnerEvents({
        events: [
          {
            name: "Test-out Taken",
            properties: {
              chapter_id: chapterId,
              passed: said.passed,
              score: said.total > 0 ? Math.round((said.correct / said.total) * PERCENT) : 0,
            },
          },
        ],
        goalId,
        userId,
      }),
    );
  }

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

  const { userId } = owned;

  return withTestSubmissionClaim({
    key: `chapter-test-out:${userId}`,
    replay: () => replaySavedReceipt({ chapterId, goalId, requestId: input.requestId, userId }),
    submit: () => submitOwnedTestOut({ chapterId, goal: owned.goal, input }),
    userId,
  });
}
