"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type OnboardingLibraryCourse } from "@zoonk/core/view-models/onboarding/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { RocketIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePrimaryVariant } from "../../_utils/fun-primary";
import { usePoll } from "../../_utils/use-poll";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { LearnLink } from "../../learn-link";
import { useExperienceMode } from "../../mode-provider";
import { FunRouteMap } from "../../plan/fun-route-map";
import { PlanAdjust } from "../../plan/plan-adjust";
import {
  type PlanActions,
  type PlanGoal,
  PlanScreenProvider,
  usePlanScreen,
} from "../../plan/plan-context";
import { PlanEditPanel } from "../../plan/plan-edit-panel";
import { PlanPhases } from "../../plan/plan-phases";
import { PlanShortPlan } from "../../plan/plan-short-plan";
import { PlanTools } from "../../plan/plan-tools";
import { usePlanEdit } from "../../plan/use-plan-edit";
import { LibraryCourseOffer } from "../library-course-offer";
import { type OnboardingActions } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { SavePlanNote } from "../save-plan-note";
import { PlanRevealStats } from "./plan-reveal-stats";
import { WAITING_RUN, getWaitRun, isRunStopped } from "./wait-run";

const POLL_MS = 3000;

/** Chapters still being outlined fill in on their own while the plan shows; outlines take minutes. */
const OUTLINE_POLL_MS = 5000;
const OUTLINE_POLL_LIMIT_MS = 300_000;

type LibraryCourseLink = { course: OnboardingLibraryCourse; href: string };

function hasChaptersBeingWritten(plan: PlanView): boolean {
  return plan.phases.some((phase) => phase.chapters?.some((chapter) => chapter.writing));
}

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
              "We're choosing what to learn first and fitting it into your days. It usually takes a minute.",
            )}
          </OnboardingDescription>
        </OnboardingHeading>
      </GenerationWait>
      {libraryCourse && <LibraryCourseOffer {...libraryCourse} />}
    </OnboardingColumn>
  );
}

/** The plan's one next step: Enter starts day 1 from anywhere on the screen. */
function StartButton({ href }: { href: string }) {
  const t = useExtracted();
  const mode = useExperienceMode();
  const primaryVariant = usePrimaryVariant();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(
        buttonVariants({ size: "lg", variant: primaryVariant }),
        "h-12 w-full text-base",
      )}
      href={href}
      ref={ref}
    >
      {mode === "fun" && <RocketIcon aria-hidden="true" />}
      {t("Start day 1")}
    </LearnLink>
  );
}

function RevealBody({
  isGuest,
  libraryCourse,
  buddy,
  signUpHref,
  todayHref,
}: {
  isGuest: boolean;
  libraryCourse: LibraryCourseLink | null;
  buddy: LearnBuddy | null;
  signUpHref: string;
  todayHref: string;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();
  const edit = usePlanEdit();
  const { goal } = usePlanScreen();

  return (
    <OnboardingColumn>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {mode === "fun" ? t("Route ready") : t("Plan ready")}
        </p>
        <OnboardingTitle>{goal.title}</OnboardingTitle>
      </div>

      <PlanRevealStats />
      <PlanShortPlan />
      <PlanAdjust onNarrowScope={() => edit.openAt("words")} />

      {mode === "fun" ? (
        <FunRouteMap buddy={buddy} tools={<PlanTools />} />
      ) : (
        <PlanPhases tools={<PlanTools />} />
      )}
      {libraryCourse && <LibraryCourseOffer {...libraryCourse} />}
      <PlanEditPanel focus={edit.focus} onOpenChange={edit.setOpen} open={edit.open} />

      {/* A long route (dozens of skills in its first phase) never hides the one next step. */}
      <OnboardingFooter className="from-background sticky bottom-0 z-20 bg-linear-to-t from-70% to-transparent">
        <StartButton href={todayHref} />
      </OnboardingFooter>

      {isGuest && <SavePlanNote signUpHref={signUpHref} />}
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
 * The last onboarding screen: the plan in the learner's mode, honest about what fits in their
 * time and what more time would change (they decide), with no score before a mock exam. One
 * button starts day 1; the plan can still be changed in plain words.
 */
export function PlanReveal({
  actions,
  goal,
  goalId,
  initialPlan,
  isGuest,
  libraryCourse,
  buddy,
  planActions,
  planLinkHref,
  run,
  signUpHref,
  testOutBasePath,
  todayHref,
}: {
  actions: OnboardingActions;
  goal: PlanGoal;
  goalId: string;
  initialPlan: PlanView | null;
  isGuest: boolean;
  /** A ready-made Library course for the same goal, offered next to the plan. */
  libraryCourse: LibraryCourseLink | null;
  buddy: LearnBuddy | null;
  planActions: PlanActions;
  planLinkHref: (planId: string) => string;
  /** The run building the plan, when the host follows it. */
  run: GenerationRun | null;
  signUpHref: string;
  /** Where a chapter's test-out lives, for chapters the learner may already know. */
  testOutBasePath: string;
  todayHref: string;
}) {
  const [plan, setPlan] = useState<PlanView | null>(initialPlan);

  const refresh = async () => {
    const outcome = await actions.getPlan(goalId);

    if (outcome.status !== "ready") {
      throw new Error("The plan couldn't be read");
    }

    setPlan(outcome.plan);
  };

  /**
   * The plan may have been written while the learner answered; check once, then until it's ready.
   * A run that failed or never started pauses it until its "Try again".
   */
  const poll = usePoll({
    active: !plan?.ready && !isRunStopped(run),
    intervalMs: POLL_MS,
    onPoll: refresh,
  });

  usePoll({
    active: Boolean(plan?.ready) && plan !== null && hasChaptersBeingWritten(plan),
    intervalMs: OUTLINE_POLL_MS,
    onPoll: refresh,
    timeoutMs: OUTLINE_POLL_LIMIT_MS,
  });

  usePlanWait({ isReady: Boolean(plan?.ready), recordPlanWait: actions.recordPlanWait });

  if (!plan?.ready) {
    return (
      <PlanBuilding
        libraryCourse={libraryCourse}
        run={getWaitRun({ poll, run: run ?? WAITING_RUN })}
      />
    );
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
    requestEdit: (text) => refreshAfter(planActions.requestEdit(text)),
  };

  return (
    <PlanScreenProvider
      value={{
        actions: refreshingActions,
        goal,
        plan,
        shareHref: planLinkHref(plan.planId),
        testOutBasePath,
      }}
    >
      <RevealBody
        isGuest={isGuest}
        libraryCourse={libraryCourse}
        buddy={buddy}
        signUpHref={signUpHref}
        todayHref={todayHref}
      />
    </PlanScreenProvider>
  );
}
