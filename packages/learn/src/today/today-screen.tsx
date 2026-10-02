"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useEffect } from "react";
import { usePoll } from "../_utils/use-poll";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import { useExperienceMode } from "../mode-provider";
import { FocusToday } from "./focus-today";
import { FunToday } from "./fun-today";
import { type TodayActions, TodayScreenProvider } from "./today-context";
import { isStopBeingWritten } from "./use-today-copy";

/** A stop whose lesson is being written is checked this often, so it updates once it's written. */
const WRITING_REFRESH_MS = 5000;

/** A stop still to do whose lesson is being written right now. */
function hasStopBeingWritten(today: TodayView): boolean {
  return today.session.blocks.some(
    (block) =>
      (block.status === "pending" || block.status === "active") &&
      isStopBeingWritten({ block, lessonStatus: today.lessonStatus }),
  );
}

/**
 * Today, the screen learners open every day, in the learner's mode. Focus and Fun read the same
 * view model and actions; only the skin differs.
 *
 * ```tsx
 * <TodayScreen actions={actions} buddy={buddy} today={today} />
 * ```
 */
export function TodayScreen({
  actions,
  buddy,
  today,
}: {
  actions: TodayActions;
  buddy: LearnBuddy | null;
  today: TodayView;
}) {
  const mode = useExperienceMode();
  const analytics = useLearnAnalytics();

  useEffect(() => {
    analytics.track({ name: "Today Viewed" });
  }, [analytics]);

  // Reads Today again while a stop's lesson is written; it stops on its own after a while.
  const poll = usePoll({
    active: hasStopBeingWritten(today),
    intervalMs: WRITING_REFRESH_MS,
    onPoll: actions.refresh,
  });

  const writingStalled = poll.status === "failed" || poll.status === "timedOut";

  return (
    <TodayScreenProvider value={{ actions, buddy, today, writingStalled }}>
      {mode === "fun" ? <FunToday /> : <FocusToday />}
    </TodayScreenProvider>
  );
}
