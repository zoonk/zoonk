"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { Page } from "../_components/page";
import { usePoll } from "../_utils/use-poll";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import { type MissionsDay } from "../missions/missions-card";
import { PageWithAside } from "../shell/learn-shell";
import { TodayAction, TodayContinueProvider } from "./today-action";
import {
  NO_TODAY_HOST_NOTICES,
  type TodayActions,
  type TodayHostNotices,
  TodayScreenProvider,
} from "./today-context";
import { getSessionState } from "./today-day-state";
import { TodayHeading } from "./today-heading";
import { TODAY_ASIDE_CLASS, TODAY_MAIN_CLASS } from "./today-layout";
import { TodayMissions } from "./today-missions";
import { TodayMore } from "./today-more";
import { TodayNotice } from "./today-notice";
import { TodayPractice } from "./today-practice";
import { TodayPreparation } from "./today-preparation";
import { TodaySession } from "./today-session-card";
import { TodayWeek } from "./today-week";
import { isStopBeingWritten } from "./use-today-copy";

export type { TodayHostNotices } from "./today-context";

/** A stop whose lesson is being written is checked this often, so it updates once it's written. */
const WRITING_REFRESH_MS = 5000;
const NO_MISTAKES: MistakeAvailability = { ready: 0, tomorrow: 0 };

/**
 * The notice's place under 72rem: the line sits close under the day's action, the aside's other
 * blocks further down.
 */
const NOTICE_CLASS = "max-[72rem]:-mt-7 sm:col-span-2";

/** From 72rem the missions, the week and the preparation lead the aside, the notice under them. */
const ASIDE_LEAD_CLASS = "min-[72rem]:order-first";

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
 * name under one quiet line (the date, the days left and where the plan stands), the day's
 * segments, its queue with the next block highlighted, and one action: Start or Continue beside
 * the title from `sm`, under the queue on a phone. Every other state (done, a rest day, nothing
 * new, lessons being written) keeps that frame and says what the day is in one line.
 *
 * Beside it, the aside (`PageWithAside`): from 72rem it runs the screen's full height at its right
 * edge (the day's missions, the week, the preparation and the one notice); under 72rem its blocks
 * follow the day, the notice first as one line, then the missions. "Practice anytime" is for
 * phones and tablets: from 72rem the sidebar and the command palette hold the same ways in.
 *
 * ```tsx
 * <TodayScreen actions={actions} buddy={buddy} notices={notices} today={today} />
 * ```
 */
export function TodayScreen({
  actions,
  brainPower = null,
  buddy,
  level = null,
  missions = null,
  mistakes = NO_MISTAKES,
  mockEntry = null,
  notices = NO_TODAY_HOST_NOTICES,
  planEnd = null,
  speakingEntry = null,
  syllabus = null,
  today,
}: {
  actions: TodayActions;
  /** The learner's Brain Power so far, said when the missions' reward is tapped. */
  brainPower?: number | null;
  /** The learner's buddy, who quizzes on a day with nothing new; null resolves to the default. */
  buddy: LearnBuddy | null;
  /** A language goal's level and the one it aims for, said where another goal's progress is. */
  level?: LanguageTodayView["level"];
  /** Today's missions; null on a day that offers none. */
  missions?: MissionsDay | null;
  /** Open entries in the mistakes notebook, offered under "Practice anytime". */
  mistakes?: MistakeAvailability;
  /** An exam's "Take a mock exam" whenever the learner wants (`MockEntryRow`). */
  mockEntry?: React.ReactNode;
  notices?: TodayHostNotices;
  /** The plan's estimated end, as the Plan shows it, for a proposed change's new end. */
  planEnd?: string | null;
  /** A language goal's exam-style speaking tasks, under "Practice anytime" (`SpeakingPracticeRow`). */
  speakingEntry?: React.ReactNode;
  /** The goal's subjects as the Plan lists them, beside the session; null when the host has none. */
  syllabus?: SyllabusView | null;
  today: TodayView;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();

  useEffect(() => {
    analytics.track({ name: "Today Viewed" });
  }, [analytics]);

  // Reads Today again while a lesson is written; it stops on its own after a while.
  const poll = usePoll({
    active: isWaitingForLessons(today),
    intervalMs: WRITING_REFRESH_MS,
    onPoll: actions.refresh,
    startNow: false,
  });

  const writingStalled = poll.status === "failed" || poll.status === "timedOut";

  return (
    <TodayScreenProvider
      value={{ actions, brainPower, buddy, missions, notices, planEnd, today, writingStalled }}
    >
      <PageWithAside
        aside={
          <>
            <TodayNotice className={NOTICE_CLASS} />
            <TodayMissions className={ASIDE_LEAD_CLASS} />
            <TodayWeek className={ASIDE_LEAD_CLASS} />
            <TodayPreparation className={ASIDE_LEAD_CLASS} level={level} syllabus={syllabus} />
            <TodayPractice
              mistakes={mistakes}
              mockEntry={mockEntry}
              speakingEntry={speakingEntry}
            />
          </>
        }
        asideClassName={TODAY_ASIDE_CLASS}
        asideLabel={t("Your week")}
      >
        <Page data-slot="today">
          <section aria-label={t("Today's session")} className={TODAY_MAIN_CLASS}>
            <TodayContinueProvider>
              <TodayHeading className="[grid-area:head]" />
              <TodayAction className="mt-4 [grid-area:action] sm:mt-0 sm:self-end" />
              <TodaySession className="mt-5 [grid-area:session]" />
              <TodayMore className="mt-4 [grid-area:more]" />
            </TodayContinueProvider>
          </section>
        </Page>
      </PageWithAside>
    </TodayScreenProvider>
  );
}
