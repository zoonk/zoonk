"use client";

import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { CelebrationScope, useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { PageSectionTitle } from "../../_components/page";
import { StepOpenFailed } from "../../_components/step-open-failed";
import { SuccessEyebrow } from "../../_components/success-eyebrow";
import { type LearnBuddy, resolveLearnBuddy } from "../../buddies/use-buddy-name";
import { PlanChoiceLines } from "../../plan/plan-choice-lines";
import { PlanChoices } from "../../plan/plan-choices";
import { usePlanScreen } from "../../plan/plan-context";
import { PlanEditor } from "../../plan/plan-editor";
import { type PlanEditorSection } from "../../plan/plan-editor-sections";
import { type DayStep } from "../../session/session-types";
import { isFinished } from "../../today/today-queue";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { SavePlanNote } from "../save-plan-note";
import { UsualStructureNote } from "./notice-reading";
import { PlanChapterList, PlanPhasesBar } from "./plan-shape";
import { RevealCoverage } from "./reveal-coverage";
import { RevealDayOpener, RevealToday, RevealWeek, findRevealStart } from "./reveal-days";
import { RevealNoticeDay } from "./reveal-notice-day";
import { RevealReadouts } from "./reveal-readouts";

/** Zu cheers on the moment's last beat, after the check and "Start here". */
function RevealBuddy({ buddy }: { buddy: LearnBuddy | null }) {
  const resolved = resolveLearnBuddy(buddy);

  return (
    <BuddyActor
      beltColor={resolved.beltColor}
      className="size-20 shrink-0 lg:size-24"
      energy={resolved.energy}
      expression="happy"
      glasses={resolved.glasses}
      kind={resolved.kind}
      label=""
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

/** Start works from the moment's first frame. */
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

  return (
    <OnboardingActions
      failed={failure === "save"}
      note={
        <>
          {failure === "open" && <StepOpenFailed />}
          {isGuest && <SavePlanNote className="text-left lg:text-right" signUpHref={signUpHref} />}
        </>
      }
    >
      <OnboardingSecondaryButton onClick={onAdjust}>{t("Adjust")}</OnboardingSecondaryButton>

      {/* A submit, so a press before the page hydrates starts once it does. */}
      <form action={() => onStart()} className="contents">
        <OnboardingPrimaryButton
          busy={pending}
          icon={<PlayIcon aria-hidden="true" />}
          type="submit"
        >
          {started ? t("Continue") : t("Start")}
        </OnboardingPrimaryButton>
      </form>
    </OnboardingActions>
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
};

function RevealColumn({
  buddy,
  isGuest,
  markRevealed,
  onStart,
  openStep,
  reveal,
  signUpHref,
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
      bar={
        <RevealActions
          failure={startFailure}
          isGuest={isGuest}
          onAdjust={() => setEditor({ open: true, section: null })}
          onStart={start}
          pending={starting}
          signUpHref={signUpHref}
          started={started}
        />
      }
      className="gap-8"
      rail={
        <RevealRailBlock title={t("Choices")}>
          <PlanChoices />
        </RevealRailBlock>
      }
      wide
    >
      <header className="flex min-w-0 flex-col gap-5 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <PlanCreated />
            <OnboardingTitle className="text-balance">{goal.displayName}</OnboardingTitle>
          </div>
          <RevealBuddy buddy={buddy} />
        </div>

        <RevealReadouts />
        <RevealCoverage onAddTime={() => setEditor({ open: true, section: "time" })} />

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

      <PlanEditor
        onOpenChange={(open) => setEditor({ ...editor, open })}
        open={editor.open}
        section={editor.section}
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
