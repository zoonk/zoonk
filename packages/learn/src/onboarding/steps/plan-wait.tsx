"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
import { type OnboardingLibraryCourse } from "@zoonk/core/view-models/onboarding/contract";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  type GenerationFirstLesson,
  type GenerationRun,
  toHeldRun,
} from "../../generation/generation-run";
import { GenerationFailureNotice, useGenerationProgress } from "../../generation/generation-wait";
import { useReadyHold } from "../../wait/use-ready-hold";
import { useDeck } from "../../wait/wait-deck";
import {
  WaitAside,
  WaitContent,
  WaitScreen,
  WaitSlot,
  useWaitScreen,
} from "../../wait/wait-screen";
import { FirstLessonLine, WaitStatus } from "../../wait/wait-status";
import { LibraryCourseOffer } from "../library-course-offer";
import { type OnboardingActions } from "../onboarding-actions";
import { useOnboardingWait } from "../onboarding-clock";
import { OnboardingColumn, OnboardingPrimaryButton } from "../onboarding-frame";
import { useOnboardingHost } from "../onboarding-host";
import { useOnboardingRail } from "../onboarding-rail";
import { NoticeReading, useNoticeProgress, useNoticeTitle } from "./notice-reading";
import { PlanBuilding, type PlanNext } from "./plan-building";
import { WaitBackToQuiz, WaitBar, WaitLinkAction } from "./wait-parts";
import { type PlanWaitScreen, type WaitStop } from "./wait-run";

type Notice = { document: ExamDocument; lastNotice: boolean; stopped: WaitStop | null };

export type LibraryCourseLink = { course: OnboardingLibraryCourse; href: string };

type PlanWaitProps = {
  children: React.ReactNode;
  /** A learn goal's first lesson, written alongside its plan; null for the other goals. */
  firstLesson: GenerationFirstLesson | null;
  lessonHref: (lessonId: string) => string;
  library: LibraryCourseLink | null;
  next: PlanNext;
  notice?: Notice;
  readWarmUp: OnboardingActions["readWarmUp"];
  run: GenerationRun;
};

/** The notice's wait comes after the plan is built, so once it showed, it's the one that may hold. */
function useShownScreen(wait: PlanWaitScreen | null): PlanWaitScreen {
  const [noticeShown, setNoticeShown] = useState(wait === "notice");

  if (wait === "notice" && !noticeShown) {
    setNoticeShown(true);
  }

  return noticeShown ? "notice" : "building";
}

/** A failure takes the strip's place, so the quiz below it stays playable. */
function getStop({ notice, run }: { notice: Notice | null; run: GenerationRun }): WaitStop | null {
  if (notice) {
    return notice.stopped;
  }

  return run.status === "failed"
    ? { failure: run.failure ?? "generation", retry: run.retry }
    : null;
}

function BuildStatus({
  firstLesson,
  holding,
  run,
  since,
}: {
  firstLesson: GenerationFirstLesson | null;
  holding: boolean;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();
  const shown = holding ? toHeldRun(run) : run;
  const value = useGenerationProgress({ kind: "curriculum", run: shown, since });

  return (
    <WaitStatus
      done={holding}
      line={firstLesson && <FirstLessonLine lesson={firstLesson} />}
      value={value}
    >
      {holding ? t("Your plan is ready") : t("Building your plan")}
    </WaitStatus>
  );
}

function NoticeStatus({
  holding,
  notice,
  since,
}: {
  holding: boolean;
  notice: Notice;
  since: number;
}) {
  const t = useExtracted();
  const title = useNoticeTitle(notice.lastNotice);
  const value = useNoticeProgress({ holding, since, stopped: null });

  return (
    <WaitStatus done={holding} value={value}>
      {holding ? t("Your plan is ready") : title}
    </WaitStatus>
  );
}

function PlanWaitBar({
  firstLesson,
  holding,
  lessonHref,
  library,
  next,
}: Pick<PlanWaitProps, "firstLesson" | "lessonHref" | "library" | "next"> & { holding: boolean }) {
  const t = useExtracted();
  const { release, slotShown, view } = useWaitScreen();
  const lessonReady = !holding && firstLesson?.status === "ready";

  if (holding) {
    return (
      <WaitBar
        // The progress view's heading already says it.
        note={
          next === "timeQuestion" && view === "quiz"
            ? t("One last question, then you'll see it.")
            : undefined
        }
      >
        <OnboardingPrimaryButton className="lg:w-auto lg:min-w-40" onClick={release}>
          {next === "plan" ? t("See your plan") : t("Continue")}
        </OnboardingPrimaryButton>
      </WaitBar>
    );
  }

  if (lessonReady) {
    return (
      <WaitBar note={t("Your plan will be waiting when you finish.")}>
        <WaitLinkAction href={lessonHref(firstLesson.id)}>{t("Start lesson 1")}</WaitLinkAction>
      </WaitBar>
    );
  }

  if (!library && !slotShown) {
    return null;
  }

  return (
    <WaitBar library={library && <LibraryCourseOffer {...library} />}>
      <WaitSlot />
    </WaitBar>
  );
}

function PlanWaitPage({
  firstLesson,
  holding,
  lessonHref,
  library,
  next,
  notice,
  run,
}: Omit<PlanWaitProps, "children" | "notice" | "readWarmUp"> & {
  holding: boolean;
  notice: Notice | null;
}) {
  const since = useMountTime().getTime();
  const flowRail = useOnboardingRail();
  const stop = holding ? null : getStop({ notice, run });

  const progress = notice ? (
    <NoticeReading {...notice} holding={holding} next={next} since={since} />
  ) : (
    <PlanBuilding firstLesson={firstLesson} holding={holding} next={next} run={run} since={since} />
  );

  const status = (() => {
    if (stop) {
      return <GenerationFailureNotice failure={stop.failure} retry={stop.retry} />;
    }

    return notice ? (
      <NoticeStatus holding={holding} notice={notice} since={since} />
    ) : (
      <BuildStatus firstLesson={firstLesson} holding={holding} run={run} since={since} />
    );
  })();

  return (
    <WaitBackToQuiz>
      <OnboardingColumn
        bar={
          <PlanWaitBar
            firstLesson={firstLesson}
            holding={holding}
            lessonHref={lessonHref}
            library={library}
            next={next}
          />
        }
        rail={
          <>
            <WaitAside>{progress}</WaitAside>
            {flowRail}
          </>
        }
      >
        <WaitContent progress={progress} status={status} />
      </OnboardingColumn>
    </WaitBackToQuiz>
  );
}

function ScreenWait({
  children,
  notice,
  readWarmUp,
  ready,
  run,
  screen,
  ...props
}: Omit<PlanWaitProps, "notice"> & {
  notice: Notice | null;
  ready: boolean;
  screen: PlanWaitScreen;
}) {
  const hold = useReadyHold(ready);
  const { coming, deck } = useDeck({ readDeck: readWarmUp, run });
  const aside = useOnboardingHost()?.kind === "page";
  // The ready screen counts while a learner who played holds it.
  useOnboardingWait(screen === "notice" ? "examNotice" : "planWait", hold.status !== "go");

  if (hold.status === "go") {
    return children;
  }

  return (
    <WaitScreen aside={aside} coming={coming} deck={deck} hold={hold} surface="planWait">
      <PlanWaitPage
        {...props}
        holding={hold.status === "hold"}
        notice={screen === "notice" ? notice : null}
        run={run}
      />
    </WaitScreen>
  );
}

/**
 * The plan's waits (its build, then its exam's notice being read), then `children` once they move
 * on. Each wait screen holds on its own: playing on the build's doesn't hold the notice's after it.
 */
export function PlanWait({
  notice,
  wait,
  ...props
}: PlanWaitProps & { wait: PlanWaitScreen | null }) {
  const screen = useShownScreen(wait);

  return (
    <ScreenWait
      key={screen}
      {...props}
      notice={notice ?? null}
      ready={wait === null}
      screen={wait ?? screen}
    />
  );
}
