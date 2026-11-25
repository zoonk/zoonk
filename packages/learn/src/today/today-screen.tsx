"use client";

import { OUTLINE_STALE_AFTER_MS } from "@zoonk/core/lookahead/outline-ahead";
import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
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

const WRITING_REFRESH_MS = 5000;

/** Outlasts a learner's ask for lessons' outlines, so a screen left open reads the day again once it lapses. */
const WRITING_WAIT_MS = OUTLINE_STALE_AFTER_MS + WRITING_REFRESH_MS;
const NO_MISTAKES: MistakeAvailability = { ready: 0, tomorrow: 0 };

const NOTICE_CLASS = "max-[72rem]:-mt-4 sm:col-span-2";

const ASIDE_LEAD_CLASS = "min-[72rem]:order-first";

function isWaitingForOutlines(today: TodayView): boolean {
  return today.session.lessonsComing || today.session.state === "waiting";
}

function getLessonsBeingWritten(today: TodayView): string[] {
  return today.session.blocks.flatMap((block) =>
    (block.status === "pending" || block.status === "active") &&
    block.lessonId &&
    isStopBeingWritten(block)
      ? [block.lessonId]
      : [],
  );
}

/** A row says a lesson is being written only while the API confirms it; any other answer reads the day again. */
function useLessonsBeingWritten({
  actions,
  readAt,
  today,
}: {
  actions: TodayActions;
  readAt: number;
  today: TodayView;
}) {
  const lessonIds = getLessonsBeingWritten(today);

  usePoll({
    active: lessonIds.length > 0,
    intervalMs: WRITING_REFRESH_MS,
    key: `${readAt}:${lessonIds.join(",")}`,
    onPoll: async (signal) => {
      const reads = await Promise.all(lessonIds.map((lessonId) => actions.readLesson(lessonId)));

      if (!signal.aborted && reads.some((read) => read && read.status !== "generating")) {
        actions.reread();
      }
    },
    startNow: false,
    timeoutMs: Number.POSITIVE_INFINITY,
  });
}

export function TodayScreen({
  actions,
  banner = null,
  buddy,
  completedLessons = false,
  language = null,
  missions = null,
  mistakes = NO_MISTAKES,
  mockEntry = null,
  notices = NO_TODAY_HOST_NOTICES,
  planEnd = null,
  readAt,
  speakingEntry = null,
  today,
  unfinishedGoal = null,
}: {
  actions: TodayActions;
  /** Above the day, for what the host needs to say first, such as a reminder's other goal. */
  banner?: React.ReactNode;
  buddy: LearnBuddy | null;
  completedLessons?: boolean;
  language?: Pick<LanguageTodayView, "level" | "targetLanguage"> | null;
  missions?: MissionsDay | null;
  mistakes?: MistakeAvailability;
  mockEntry?: React.ReactNode;
  notices?: TodayHostNotices;
  planEnd?: string | null;
  /** Each new read waits a full window again, for whatever it shows waiting. */
  readAt: number;
  speakingEntry?: React.ReactNode;
  today: TodayView;
  /** A goal the learner typed and hasn't confirmed, offered with the day's notice. */
  unfinishedGoal?: React.ReactNode;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    analytics.track({ name: "Today Viewed" });
  }, [analytics]);

  useLessonsBeingWritten({ actions, readAt, today });

  const poll = usePoll({
    active: isWaitingForOutlines(today),
    intervalMs: WRITING_REFRESH_MS,
    key: String(readAt),
    onPoll: actions.refresh,
    startNow: false,
    timeoutMs: WRITING_WAIT_MS,
  });

  const writingStalled = poll.status === "failed" || poll.status === "timedOut";

  return (
    <TodayScreenProvider
      value={{ actions, buddy, missions, notices, planEnd, today, writingStalled }}
    >
      <TodayContinueProvider>
        <PageWithAside
          aside={
            <>
              <TodayNotice className={NOTICE_CLASS} fallbackFocus={aside}>
                {unfinishedGoal}
              </TodayNotice>
              <TodayMissions className={ASIDE_LEAD_CLASS} />
              <TodayWeek className={ASIDE_LEAD_CLASS} />
              <TodayPreparation className={ASIDE_LEAD_CLASS} language={language} />
              <TodayPractice
                completedLessons={completedLessons}
                completedLessonsHref={actions.completedLessonsHref}
                mistakes={mistakes}
                mistakesHref={actions.mistakesHref}
                mockEntry={mockEntry}
                speakingEntry={speakingEntry}
              />
            </>
          }
          asideClassName={TODAY_ASIDE_CLASS}
          asideLabel={t("Your week")}
          asideRef={aside}
          bottomBar={<TodayAction />}
        >
          <Page data-slot="today">
            {banner}
            <section aria-label={t("Today's lessons")} className={TODAY_MAIN_CLASS}>
              <TodayHeading />
              <TodaySession className="mt-5" />
              <TodayMore className="mt-4" />
            </section>
          </Page>
        </PageWithAside>
      </TodayContinueProvider>
    </TodayScreenProvider>
  );
}
