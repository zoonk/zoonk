"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { CelebrationScope, useCelebration } from "@zoonk/ui/hooks/celebration";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { PageSectionTitle } from "../../_components/page";
import { ChangeSaveError } from "../../_components/save-error";
import { StepOpenFailed } from "../../_components/step-open-failed";
import { SuccessEyebrow } from "../../_components/success-eyebrow";
import { BuddyArt } from "../../buddies/buddy-art";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { PlanChoiceLines } from "../../plan/plan-choice-lines";
import { PlanChoices } from "../../plan/plan-choices";
import { usePlanScreen } from "../../plan/plan-context";
import { PlanEditor } from "../../plan/plan-editor";
import { type PlanEditorSection } from "../../plan/plan-editor-sections";
import { type DayStep } from "../../session/session-types";
import { isFinished } from "../../today/today-queue";
import { OnboardingColumn, OnboardingTitle } from "../onboarding-frame";
import { SavePlanNote } from "../save-plan-note";
import { UsualStructureNote } from "./notice-reading";
import { AreaWeights, PlanChapterList, PlanPhasesBar } from "./plan-shape";
import { RevealCoverage } from "./reveal-coverage";
import { RevealDayOpener, RevealToday, RevealWeek, findRevealStart } from "./reveal-days";
import { RevealNoticeDay } from "./reveal-notice-day";
import { RevealReadouts } from "./reveal-readouts";

/** Zu cheers on the moment's last beat, after the check, the count and "Start here". */
function RevealBuddy({ buddy }: { buddy: LearnBuddy | null }) {
  return (
    <BuddyArt
      buddy={buddy}
      className="h-23 lg:h-28"
      expression="happy"
      reaction={{ act: "cheer", delayMs: 3 * BEAT_MS }}
      studiedToday
    />
  );
}

function PlanCreated() {
  const t = useExtracted();
  const celebrate = useCelebration();

  return (
    <SuccessEyebrow iconClassName={cn(celebrate && "animate-settle")}>
      {t("Plan created")}
    </SuccessEyebrow>
  );
}

/**
 * Pinned to the bottom on phones and tablets, where the plan scrolls under it, and beside the hero
 * from `lg`. Start works from the moment's first frame.
 */
function RevealActions({
  failure,
  isGuest,
  onAdjust,
  onStart,
  pending,
  signUpHref,
  started,
}: {
  /** What failed, so the learner reads whether the plan didn't save or its step didn't open. */
  failure: StartFailure | null;
  isGuest: boolean;
  onAdjust: () => void;
  onStart: () => void;
  pending: boolean;
  signUpHref: string;
  started: boolean;
}) {
  const t = useExtracted();
  const startRef = useEnterClick<HTMLButtonElement>();

  return (
    <div
      className={cn(
        "bg-background sticky bottom-0 -mx-4 flex flex-col gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "lg:static lg:col-2! lg:row-start-1 lg:mx-0 lg:w-56 lg:self-start lg:border-t-0 lg:p-0",
      )}
      data-slot="reveal-actions"
    >
      {failure === "save" && <ChangeSaveError />}
      {failure === "open" && <StepOpenFailed />}

      <div className="flex gap-2 lg:flex-col-reverse">
        <Button className="flex-1 lg:flex-none" onClick={onAdjust} size="lg" variant="outline">
          {t("Adjust")}
        </Button>

        {/* A submit, so a press before the page hydrates starts once it does. */}
        <form action={() => onStart()} className="contents">
          <Button
            aria-keyshortcuts="Enter"
            busy={pending}
            className="flex-2 font-[560] lg:flex-none"
            icon={<PlayIcon aria-hidden="true" />}
            ref={startRef}
            size="lg"
            type="submit"
          >
            {started ? t("Continue") : t("Start")}
            <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
          </Button>
        </form>
      </div>

      {isGuest && <SavePlanNote className="lg:text-right" signUpHref={signUpHref} />}
    </div>
  );
}

function RevealRailBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col gap-2 not-has-[>:nth-child(2)]:hidden">
      <PageSectionTitle className="hidden min-[72rem]:block">{title}</PageSectionTitle>
      {children}
    </div>
  );
}

type StartFailure = "open" | "save";

type RevealBodyProps = {
  buddy: LearnBuddy | null;
  isGuest: boolean;
  onStart: () => Promise<boolean>;
  reveal: PlanRevealDays | null;
  signUpHref: string;
  syllabus: SyllabusView | null;
};

function RevealColumn({
  buddy,
  isGuest,
  markRevealed,
  onStart,
  openStep,
  reveal,
  signUpHref,
  syllabus,
}: RevealBodyProps & {
  markRevealed: () => Promise<boolean>;
  openStep: ((step: DayStep) => Promise<boolean>) | null;
}) {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const started = reveal?.today.blocks.some((block) => isFinished(block)) ?? false;
  const startStep = findRevealStart(reveal);

  // Saved first on its own, so a failure says whether the plan or the step is what didn't go.
  const openStart =
    openStep && startStep
      ? async (): Promise<StartFailure | null> => {
          if (!(await markRevealed())) {
            return "save";
          }

          return (await openStep(startStep)) ? null : "open";
        }
      : null;

  const [starting, startTransition] = useTransition();
  const [startFailure, setStartFailure] = useState<StartFailure | null>(null);

  // Busy until the next page opens, with the rows waiting; a failed start keeps the learner here.
  const start = () => {
    setStartFailure(null);

    startTransition(async () => {
      const { data, error } = await safeAsync(
        openStart ?? (async () => ((await onStart()) ? null : "save")),
      );

      setStartFailure(error ? "save" : data);
    });
  };

  const [editor, setEditor] = useState<{ open: boolean; section: PlanEditorSection | null }>({
    open: false,
    section: null,
  });

  return (
    <OnboardingColumn
      className="gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:content-start lg:gap-x-10 lg:*:col-span-2"
      rail={
        <>
          <RevealRailBlock title={t("What fits")}>
            <RevealCoverage syllabus={syllabus} />
          </RevealRailBlock>

          <RevealRailBlock title={t("Choices")}>
            <PlanChoices />
          </RevealRailBlock>
        </>
      }
      wide
    >
      <header className="flex min-w-0 flex-col gap-5 pt-2 lg:col-1! lg:row-start-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <PlanCreated />
            <OnboardingTitle className="text-balance">{goal.displayName}</OnboardingTitle>
          </div>
          <RevealBuddy buddy={buddy} />
        </div>

        <RevealReadouts />

        <PlanChoiceLines
          choices={plan.examChoices}
          onChange={() => setEditor({ open: true, section: "choices" })}
        />
        <RevealNoticeDay />
      </header>

      <RevealToday locked={starting} open={openStep} reveal={reveal} />
      <RevealWeek reveal={reveal} />

      <div className="flex flex-col gap-2">
        <PlanPhasesBar />
        <PlanChapterList />
        {plan.notice === "usual" && <UsualStructureNote />}
      </div>

      <AreaWeights syllabus={syllabus} />

      <PlanEditor
        onOpenChange={(open) => setEditor({ ...editor, open })}
        open={editor.open}
        section={editor.section}
      />

      <RevealActions
        isGuest={isGuest}
        onAdjust={() => setEditor({ open: true, section: null })}
        failure={startFailure}
        onStart={start}
        pending={starting}
        signUpHref={signUpHref}
        started={started}
      />
    </OnboardingColumn>
  );
}

/** Start opens the step its tagged row opens, and goes to Today only when there's none. */
export function RevealBody({
  goalId,
  markRevealed,
  moment,
  refresh,
  ...props
}: RevealBodyProps & {
  goalId: string;
  markRevealed: () => Promise<boolean>;
  /** False once the learner pressed Start: a reveal they open again shows its end, still. */
  moment: boolean;
  refresh: () => void;
}) {
  return (
    <CelebrationScope play={moment}>
      <RevealDayOpener
        goalId={goalId}
        markRevealed={markRevealed}
        refresh={refresh}
        reveal={props.reveal}
      >
        {(openStep) => <RevealColumn {...props} markRevealed={markRevealed} openStep={openStep} />}
      </RevealDayOpener>
    </CelebrationScope>
  );
}
