"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type OnboardingLibraryCourse } from "@zoonk/core/view-models/onboarding/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { type PlanActions, type PlanGoal, PlanScreenProvider } from "../../plan/plan-context";
import { PlanSheetHosts } from "../../plan/plan-sheet-hosts";
import { LibraryCourseOffer } from "../library-course-offer";
import { type OnboardingActions, type RevealedPlan } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { NoticeReading } from "./notice-reading";
import { RevealBody } from "./reveal-body";
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
  focusTestHref: string;
  goal: PlanGoal;
  goalId: string;
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  libraryCourse: LibraryCourseLink | null;
  planActions: PlanActions;
  planLinkHref: (planId: string) => string;
  run: GenerationRun | null;
  signUpHref: string;
  todayHref: string;
}) {
  const [plan, setPlan] = useState<PlanView | null>(initialPlan?.plan ?? null);
  const [syllabus, setSyllabus] = useState<SyllabusView | null>(initialPlan?.syllabus ?? null);
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

  // The page read the plan before placement's answers changed it, so the reveal reads it once more.
  const readAgain = useEffectEvent(() => {
    void safeAsync(refresh);
  });

  useEffect(() => {
    if (initialPlan?.plan.ready) {
      readAgain();
    }
  }, [initialPlan?.plan.ready]);

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

  if (readingNotice) {
    return (
      <NoticeReading document={plan.examDocument} lastNotice={plan.schedule.targetDateEstimated} />
    );
  }

  async function refreshAfter<T>(change: Promise<T>): Promise<T> {
    const done = await change;
    await safeAsync(refresh);
    return done;
  }

  const refreshingActions: PlanActions = {
    adviseOnBases: planActions.adviseOnBases,
    change: (operations) => refreshAfter(planActions.change(operations)),
    chooseExamOption: (input) => refreshAfter(planActions.chooseExamOption(input)),
    chooseTools: (input) => refreshAfter(planActions.chooseTools(input)),
    decide: (input) => refreshAfter(planActions.decide(input)),
    findTimeToCover: planActions.findTimeToCover,
    preview: planActions.preview,
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
      <PlanSheetHosts>
        <RevealBody
          isGuest={isGuest}
          signUpHref={signUpHref}
          syllabus={syllabus}
          todayHref={todayHref}
        />
      </PlanSheetHosts>
    </PlanScreenProvider>
  );
}
