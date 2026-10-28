"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
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
import { TodayEarlierWork } from "./today-earlier-work";
import { TodayHeading } from "./today-heading";
import { TODAY_ACTION_CLASS, TODAY_ASIDE_CLASS, TODAY_MAIN_CLASS } from "./today-layout";
import { TodayMissions } from "./today-missions";
import { TodayMore } from "./today-more";
import { TodayNotice } from "./today-notice";
import { TodayPractice } from "./today-practice";
import { TodayPreparation } from "./today-preparation";
import { TodaySession } from "./today-session-card";
import { type TodaySyllabus } from "./today-subject-rows";
import { TodayWeek } from "./today-week";
import { isStopBeingWritten } from "./use-today-copy";

export type { TodayHostNotices } from "./today-context";
export type { TodaySyllabus } from "./today-subject-rows";

const WRITING_REFRESH_MS = 5000;
const NO_MISTAKES: MistakeAvailability = { ready: 0, tomorrow: 0 };

const NOTICE_CLASS = "max-[72rem]:-mt-7 sm:col-span-2";

const ASIDE_LEAD_CLASS = "min-[72rem]:order-first";

function isWaitingForLessons(today: TodayView): boolean {
  const beingWritten = today.session.blocks.some(
    (block) =>
      (block.status === "pending" || block.status === "active") &&
      isStopBeingWritten({ block, lessonStatus: today.lessonStatus }),
  );

  return beingWritten || today.session.lessonsComing || getSessionState(today.session).waiting;
}

function TodaySessionWithEarlierWork() {
  return (
    <div className="mt-5 [grid-area:session]">
      <TodayEarlierWork />
      <TodaySession />
    </div>
  );
}

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
  brainPower?: number | null;
  buddy: LearnBuddy | null;
  level?: LanguageTodayView["level"];
  missions?: MissionsDay | null;
  mistakes?: MistakeAvailability;
  mockEntry?: React.ReactNode;
  notices?: TodayHostNotices;
  planEnd?: string | null;
  speakingEntry?: React.ReactNode;
  syllabus?: TodaySyllabus | null;
  today: TodayView;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();

  useEffect(() => {
    analytics.track({ name: "Today Viewed" });
  }, [analytics]);

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
              <TodayAction className={TODAY_ACTION_CLASS} />
              <TodaySessionWithEarlierWork />
              <TodayMore className="mt-4 [grid-area:more]" />
            </TodayContinueProvider>
          </section>
        </Page>
      </PageWithAside>
    </TodayScreenProvider>
  );
}
