import "server-only";
import { type Goal, type LearningEvent } from "@zoonk/db";
import { type AnalyticsEvent } from "../../../analytics/events";
import { settleFinishedChapters, toFinishedChapterIds } from "../../../mind-maps/finished-chapters";
import { settleAnsweredActivity } from "../../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../../stats/completion-energy";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { testOutKnownPlanItems } from "../../_utils/test-out-known-plan-items";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { type ChapterTestOutInput } from "../test-out-contract";
import { getChapterTestOutSkills } from "./chapter-items";
import { pendingTestOutPlans } from "./finish-test-out-plans";
import { scoreChapter } from "./score-chapter";
import { loadTestOutPlan } from "./test-out-plan";
import { findTestOutEvent } from "./test-out-receipt";

type RecordedTestOut =
  | { status: "invalidItem" | "notFound" | "nothingToSkip" }
  | {
      event: LearningEvent;
      events: AnalyticsEvent[];
      progress: Awaited<ReturnType<typeof settleAnsweredActivity>>["progress"] | null;
      status: "ready";
    };

export async function recordTestOut({
  chapterId,
  goal,
  input,
}: {
  chapterId: string;
  goal: Goal;
  input: ChapterTestOutInput;
}) {
  const { id: goalId, userId } = goal;
  const { requestId } = input;
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  return writeLearnerChange<RecordedTestOut>({ planInputs: true, userId }, async (tx) => {
    const saved = await findTestOutEvent({ chapterId, goalId, requestId, tx, userId });

    if (saved) {
      return unchanged<RecordedTestOut>({
        event: saved,
        events: [],
        progress: null,
        status: "ready" as const,
      });
    }

    const plan = await loadTestOutPlan(goalId, { goal, tx });
    const eligible = getChapterTestOutSkills({ chapterId, plan });

    if (eligible.status !== "ready") {
      return unchanged(eligible);
    }

    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });
    const answeredAt = lock.completedAt;

    const taken = await scoreChapter({
      answeredAt,
      chapterSkills: eligible.skills,
      goal,
      input,
      timeZone,
      tx,
      userId,
    });

    if (!taken) {
      return unchanged({ status: "invalidItem" as const });
    }

    const { events, graded, knownSkillIds, score } = taken;

    const { itemIds, sharedItemIds } =
      knownSkillIds.size > 0
        ? await testOutKnownPlanItems(tx, {
            goalId,
            items: plan.items,
            knownSkillIds,
            testedOutAt: answeredAt,
            timeZone,
          })
        : { itemIds: [], sharedItemIds: [] };

    const finished = await settleFinishedChapters(tx, {
      planItemIds: [...itemIds, ...sharedItemIds],
      userId,
    });

    const pendingPlans = await pendingTestOutPlans({
      goalId,
      itemIds,
      sharedItemIds,
      timeZone,
      tx,
    });

    const { event, progress } = await settleAnsweredActivity(tx, {
      answers: graded.map(({ answer, isCorrect }) => ({
        durationMs: answer.durationMs,
        isCorrect,
      })),
      contentIds: {
        ...toFinishedChapterIds(
          finished.find(
            (chapter) => chapter.chapterId === chapterId && chapter.goalId === goalId,
          ) ?? null,
        ),
        chapterId,
        lessonsSkipped: String(itemIds.length),
        pendingPlans,
        testOutId: requestId,
        testOutPassed: String(score.passed && knownSkillIds.size === score.knownSkillIds.length),
      },
      goalId,
      lessonKind: "testOut",
      lock,
      timeZone,
      userId,
    });

    return { event, events, progress, status: "ready" as const };
  });
}
