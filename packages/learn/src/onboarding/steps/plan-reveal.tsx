"use client";

import { NOTICE_SOURCE } from "@zoonk/core/plans/change-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type OnboardingLibraryCourse } from "@zoonk/core/view-models/onboarding/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { CalendarDaysIcon, ClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { FactChip, FactChips } from "../../_components/fact-chips";
import { daysUntilIsoDate, useFormatIsoDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { usePoll } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { JourneyPath } from "../../journey/journey-path";
import { LearnLink } from "../../learn-link";
import {
  type PlanActions,
  type PlanGoal,
  PlanScreenProvider,
  usePlanScreen,
} from "../../plan/plan-context";
import { PlanEditor } from "../../plan/plan-editor";
import { PlanNotice } from "../../plan/plan-notice";
import { SyllabusSummary } from "../../syllabus/syllabus-summary";
import { LibraryCourseOffer } from "../library-course-offer";
import { type OnboardingActions, type RevealedPlan } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { SavePlanNote } from "../save-plan-note";
import { NoticeDateNote, NoticeReading, UsualStructureNote } from "./notice-reading";
import { StepLoading } from "./step-parts";
import { WAITING_RUN, getWaitRun, isRunStopped } from "./wait-run";

const POLL_MS = 3000;

type LibraryCourseLink = { course: OnboardingLibraryCourse; href: string };

function PlanBuilding({
  libraryCourse,
  run,
}: {
  libraryCourse: LibraryCourseLink | null;
  run: GenerationRun;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <GenerationWait kind="curriculum" run={run}>
        <OnboardingHeading>
          <OnboardingTitle>{t("Building your plan")}</OnboardingTitle>
          <OnboardingDescription>
            {t(
              "We're choosing what to learn first and fitting it into your days. A new subject can take a minute or two.",
            )}
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>
      {libraryCourse && <LibraryCourseOffer {...libraryCourse} />}
    </OnboardingColumn>
  );
}

/**
 * The plan's one next step: Enter starts day 1 from anywhere on the screen. Today isn't
 * prefetched: a copy taken while onboarding was still saving could send the learner back to the
 * start, so day 1 is always read fresh.
 */
function StartButton({ href }: { href: string }) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
      href={href}
      prefetch={false}
      ref={ref}
    >
      {t("Start")}
    </LearnLink>
  );
}

/**
 * The plan's shape as two facts: how long until the goal (or when it ends at this pace), and the
 * time a day.
 */
function RevealFacts() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const today = useMountTime();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const { dailyMinutes, targetDate, targetDateEstimated } = plan.schedule;
  const { endDate } = plan.estimate;

  return (
    <FactChips>
      {targetDate && (
        <FactChip>
          <CalendarDaysIcon aria-hidden="true" />
          {targetDateEstimated
            ? t("{days, plural, one {About # day} other {About # days}}", {
                days: daysUntilIsoDate({ isoDate: targetDate, today }),
              })
            : t("{days, plural, one {# day} other {# days}}", {
                days: daysUntilIsoDate({ isoDate: targetDate, today }),
              })}
        </FactChip>
      )}
      {!targetDate && endDate && (
        <FactChip>
          <CalendarDaysIcon aria-hidden="true" />
          {t("Until about {date}", { date: formatDate(endDate, "month") })}
        </FactChip>
      )}
      <FactChip>
        <ClockIcon aria-hidden="true" />
        {t("{time} a day", { time: formatDuration(dailyMinutes) })}
      </FactChip>
    </FactChips>
  );
}

/**
 * The notice's exam day waiting for the learner's answer on Today: the notice puts the exam on
 * another day than the one they gave (another month than the one they said), and the plan keeps
 * theirs until they choose. Null when no such change waits.
 */
function findWaitingNoticeDay(changes: PlanView["changes"]): string | null {
  const operation = changes
    .filter((change) => change.status === "proposed" && change.source === NOTICE_SOURCE)
    .flatMap((change) => change.operations)
    .find((candidate) => candidate.kind === "setNoticeDate");

  return operation?.kind === "setNoticeDate" ? operation.targetDate : null;
}

function RevealBody({
  isGuest,
  signUpHref,
  syllabus,
  todayHref,
}: {
  isGuest: boolean;
  signUpHref: string;
  syllabus: SyllabusView | null;
  todayHref: string;
}) {
  const t = useExtracted();
  const [editing, setEditing] = useState(false);
  const { goal, plan } = usePlanScreen();
  // A class test's day comes from the learner, or their own material: never from a notice.
  const noticeDay = syllabus?.fromMaterial ? null : findWaitingNoticeDay(plan.changes);

  return (
    <OnboardingColumn>
      <div className="flex flex-col gap-4">
        <OnboardingHeading>
          <OnboardingTitle>{t("Your plan is ready")}</OnboardingTitle>
          <OnboardingDescription>{goal.title}</OnboardingDescription>
        </OnboardingHeading>

        <RevealFacts />
        {noticeDay && plan.notice !== "usual" && <NoticeDateNote isoDate={noticeDay} />}
        <PlanNotice onAdjust={() => setEditing(true)} />
        {plan.notice === "usual" && <UsualStructureNote />}
      </div>

      <SyllabusSummary dailyMinutes={plan.schedule.dailyMinutes} syllabus={syllabus} />
      <JourneyPath />

      {/* A long plan never hides the one next step. */}
      <OnboardingFooter className="from-background sticky bottom-0 z-20 bg-linear-to-t from-70% to-transparent">
        <StartButton href={todayHref} />
        {isGuest && <SavePlanNote signUpHref={signUpHref} />}
      </OnboardingFooter>

      <PlanEditor onOpenChange={setEditing} open={editing} />
    </OnboardingColumn>
  );
}

/**
 * "Generation Waited" (curriculum): from the plan-building screen to the plan, sent once through
 * the host. A plan that was ready when the screen opened waited for nothing, so it sends nothing.
 */
function usePlanWait({
  isReady,
  recordPlanWait,
}: {
  isReady: boolean;
  recordPlanWait: (milliseconds: number) => Promise<void>;
}) {
  const startedAt = useRef<number | null>(null);

  const record = useEffectEvent((milliseconds: number) => {
    void recordPlanWait(milliseconds);
  });

  useEffect(() => {
    if (!isReady) {
      startedAt.current ??= Date.now();
      return;
    }

    if (startedAt.current === null) {
      return;
    }

    const milliseconds = Date.now() - startedAt.current;
    startedAt.current = null;
    record(milliseconds);
  }, [isReady]);
}

/**
 * The last onboarding screen: the plan's shape in two facts, honest about how much of the goal
 * their time covers ("Adjust" when it doesn't cover it all), the goal's structure (an exam's
 * notice subjects and topics, or the plan's modules, all one tap away) and its path of phases to
 * the goal. One button starts.
 */
export function PlanReveal({
  actions,
  focusTestHref,
  goal,
  goalId,
  initialPlan,
  isGuest,
  libraryCourse,
  planActions,
  planLinkHref,
  run,
  signUpHref,
  todayHref,
}: {
  actions: OnboardingActions;
  /** The goal's focus test, offered beside choosing where to focus. */
  focusTestHref: string;
  goal: PlanGoal;
  goalId: string;
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  /** A ready-made Library course for the same goal, offered next to the plan. */
  libraryCourse: LibraryCourseLink | null;
  planActions: PlanActions;
  planLinkHref: (planId: string) => string;
  /** The run building the plan, when the host follows it. */
  run: GenerationRun | null;
  signUpHref: string;
  todayHref: string;
}) {
  const [plan, setPlan] = useState<PlanView | null>(initialPlan?.plan ?? null);
  const [syllabus, setSyllabus] = useState<SyllabusView | null>(initialPlan?.syllabus ?? null);
  // Without the page's read (the steps changed the plan since), nothing shows until a fresh one.
  const [read, setRead] = useState(initialPlan !== null);

  const refresh = async () => {
    const outcome = await actions.getPlan(goalId);

    if (outcome.status !== "ready") {
      throw new Error("The plan couldn't be read");
    }

    setPlan(outcome.plan);
    setSyllabus(outcome.syllabus);
    setRead(true);
  };

  // The page read the plan before placement's answers changed it (lessons tested out, what fits),
  // so the reveal reads it once more when it shows: it never states the plan as it was before.
  const readAgain = useEffectEvent(() => {
    void safeAsync(refresh);
  });

  useEffect(() => {
    if (initialPlan?.plan.ready) {
      readAgain();
    }
  }, [initialPlan?.plan.ready]);

  /**
   * The plan may have been written while the learner answered; check once, then until it's ready.
   * A run that failed or never started pauses it until its "Try again".
   */
  const readingNotice = plan?.notice === "reading";

  const poll = usePoll({
    active: (!plan?.ready && !isRunStopped(run)) || readingNotice,
    intervalMs: POLL_MS,
    onPoll: refresh,
  });

  usePlanWait({
    isReady: Boolean(plan?.ready) && !readingNotice,
    recordPlanWait: actions.recordPlanWait,
  });

  if (!plan?.ready) {
    return !read && poll.status === "polling" ? (
      <StepLoading />
    ) : (
      <PlanBuilding
        libraryCourse={libraryCourse}
        run={getWaitRun({ poll, run: run ?? WAITING_RUN })}
      />
    );
  }

  // An exam's plan waits for research's reading of the notice, so the learner sees the notice's
  // plan; the wait has a cap, and a later reading arrives on Today as a change to apply.
  if (readingNotice) {
    return <NoticeReading lastNotice={plan.schedule.targetDateEstimated} />;
  }

  // After a change, the plan is read again; a failed read keeps the plan as it was.
  async function refreshAfter<T>(change: Promise<T>): Promise<T> {
    const done = await change;
    await safeAsync(refresh);
    return done;
  }

  const refreshingActions: PlanActions = {
    change: (operations) => refreshAfter(planActions.change(operations)),
    chooseTools: (input) => refreshAfter(planActions.chooseTools(input)),
    decide: (input) => refreshAfter(planActions.decide(input)),
  };

  return (
    <PlanScreenProvider
      value={{
        actions: refreshingActions,
        focusTestHref,
        goal,
        plan,
        shareHref: planLinkHref(plan.planId),
      }}
    >
      <RevealBody
        isGuest={isGuest}
        signUpHref={signUpHref}
        syllabus={syllabus}
        todayHref={todayHref}
      />
    </PlanScreenProvider>
  );
}
