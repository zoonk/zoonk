"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useEffect } from "react";
import { Page } from "../_components/page";
import { usePoll } from "../_utils/use-poll";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import {
  NO_TODAY_HOST_NOTICES,
  type TodayActions,
  type TodayHostNotices,
  TodayScreenProvider,
} from "./today-context";
import { TodayHeading } from "./today-heading";
import { TodayNotice } from "./today-notice";
import { TodayPractice } from "./today-practice";
import { TodaySessionCard } from "./today-session-card";
import { TodayWeek } from "./today-week";
import { getSessionState, isStopBeingWritten } from "./use-today-copy";

export type { TodayHostNotices } from "./today-context";

/** A stop whose lesson is being written is checked this often, so it updates once it's written. */
const WRITING_REFRESH_MS = 5000;

/**
 * Whether Today waits for a lesson: a stop still to do whose lesson is being written right now, a
 * study day whose lessons aren't there yet, or one holding time for more still being outlined.
 */
function isWaitingForLessons(today: TodayView): boolean {
  const beingWritten = today.session.blocks.some(
    (block) =>
      (block.status === "pending" || block.status === "active") &&
      isStopBeingWritten({ block, lessonStatus: today.lessonStatus }),
  );

  return beingWritten || today.session.lessonsComing || getSessionState(today.session).waiting;
}

/**
 * Today, the screen learners open every day, with one job: start or continue today's session. Its
 * name under the date with the days left and where the plan stands, at most one notice, then
 * sections under their headers: the session (the next block and the few after it), the week, and
 * what to practice anytime. Everything else lives in the Journey and the buddy's tab.
 *
 * ```tsx
 * <TodayScreen actions={actions} buddy={buddy} notices={notices} today={today} />
 * ```
 */
export function TodayScreen({
  actions,
  buddy,
  mistakes = 0,
  mockEntry = null,
  notices = NO_TODAY_HOST_NOTICES,
  planEnd = null,
  today,
}: {
  actions: TodayActions;
  /** The learner's buddy, who cheers a finished day; null until they pick one. */
  buddy: LearnBuddy | null;
  /** Open entries in the mistakes notebook, offered under "Practice anytime". */
  mistakes?: number;
  /** An exam's "Take a mock exam" whenever the learner wants, after the week (`MockEntryRow`). */
  mockEntry?: React.ReactNode;
  notices?: TodayHostNotices;
  /** The plan's estimated end, as the Journey shows it, for a proposed change's new end. */
  planEnd?: string | null;
  today: TodayView;
}) {
  const analytics = useLearnAnalytics();

  useEffect(() => {
    analytics.track({ name: "Today Viewed" });
  }, [analytics]);

  // Reads Today again while a lesson is written; it stops on its own after a while.
  const poll = usePoll({
    active: isWaitingForLessons(today),
    intervalMs: WRITING_REFRESH_MS,
    onPoll: actions.refresh,
  });

  const writingStalled = poll.status === "failed" || poll.status === "timedOut";

  return (
    <TodayScreenProvider value={{ actions, buddy, notices, planEnd, today, writingStalled }}>
      <Page data-slot="today">
        <TodayHeading />
        <TodayNotice />
        <TodaySessionCard />
        <TodayWeek />
        <TodayPractice mistakes={mistakes} mockEntry={mockEntry} />
      </Page>
    </TodayScreenProvider>
  );
}
