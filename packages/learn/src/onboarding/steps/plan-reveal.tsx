"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type OnboardingLibraryCourse } from "@zoonk/core/view-models/onboarding/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useEffect, useEffectEvent, useState } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { type GenerationRun } from "../../generation/generation-run";
import { type PlanActions, type PlanGoal, PlanScreenProvider } from "../../plan/plan-context";
import { PlanSheetHosts } from "../../plan/plan-sheet-hosts";
import { LibraryCourseOffer } from "../library-course-offer";
import { type OnboardingActions, type RevealedPlan } from "../onboarding-actions";
import { PlanWait } from "./plan-wait";
import { RevealBody } from "./reveal-body";
import { StepLoading } from "./step-parts";
import {
  WAITING_RUN,
  getNoticeStop,
  getRevealWait,
  getWaitRun,
  isPlanMade,
  isRunStopped,
} from "./wait-run";

const POLL_MS = 3000;

type LibraryCourseLink = { course: OnboardingLibraryCourse; href: string };

export function PlanReveal({
  actions,
  buddy,
  focusTestHref,
  goal,
  goalId,
  initialPlan,
  isGuest,
  libraryCourse,
  onPlanReadyChange,
  planActions,
  planLinkHref,
  planRevealed,
  run,
  signUpHref,
  toToday,
}: {
  actions: OnboardingActions;
  buddy: LearnBuddy | null;
  focusTestHref: string;
  goal: PlanGoal;
  goalId: string;
  initialPlan: RevealedPlan | null;
  isGuest: boolean;
  libraryCourse: LibraryCourseLink | null;
  onPlanReadyChange: (isReady: boolean) => void;
  planActions: PlanActions;
  planLinkHref: (planId: string) => string;
  planRevealed: boolean;
  run: GenerationRun | null;
  signUpHref: string;
  toToday: () => void;
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

  const readingNotice = plan?.notice === "reading";
  const wait = getRevealWait(plan);
  const shown = wait === null;

  // The page read the plan before placement's answers changed it, so the reveal reads it once more.
  const readAgain = useEffectEvent(() => {
    if (initialPlan?.plan.ready) {
      void safeAsync(refresh);
    }
  });

  useEffect(() => {
    readAgain();
  }, []);

  const poll = usePoll({
    active: (!plan?.ready && !isRunStopped(run)) || readingNotice,
    intervalMs: POLL_MS,
    key: String(isPlanMade(run)),
    onPoll: refresh,
    timeoutMs: Infinity,
  });

  const isLoading = !read && poll.status === "polling";

  useEffect(() => {
    if (!isLoading) {
      onPlanReadyChange(shown);
    }
  }, [isLoading, onPlanReadyChange, shown]);

  const waitRun = getWaitRun({ poll, run: run ?? WAITING_RUN });

  if (isLoading) {
    return <StepLoading />;
  }

  // Today waits for this: until it's saved, Today sends the learner back here.
  const start = async (): Promise<boolean> => {
    const { data: saved } = await safeAsync(() => actions.markPlanRevealed(goalId));

    if (saved) {
      toToday();
    }

    return saved === true;
  };

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
    <PlanWait
      next="plan"
      notice={
        plan
          ? {
              document: plan.examDocument,
              lastNotice: plan.schedule.targetDateEstimated,
              stopped: getNoticeStop({ poll, run }),
            }
          : undefined
      }
      offer={libraryCourse && <LibraryCourseOffer {...libraryCourse} />}
      readWarmUp={actions.readWarmUp}
      run={waitRun}
      wait={wait}
    >
      {plan && (
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
              buddy={buddy}
              isGuest={isGuest}
              moment={!planRevealed}
              onStart={start}
              signUpHref={signUpHref}
              syllabus={syllabus}
            />
          </PlanSheetHosts>
        </PlanScreenProvider>
      )}
    </PlanWait>
  );
}
