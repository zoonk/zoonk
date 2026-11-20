"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { StepOpenFailed } from "../../_components/step-open-failed";
import { PlanChoiceLines } from "../../plan/plan-choice-lines";
import { usePlanScreen } from "../../plan/plan-context";
import { PlanEditor } from "../../plan/plan-editor";
import { type PlanEditorSection } from "../../plan/plan-editor-sections";
import { type DayStep } from "../../session/session-types";
import { isFinished } from "../../today/today-queue";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { OnboardingRailSection } from "../onboarding-rail";
import { SavePlanNote } from "../save-plan-note";
import { UsualStructureNote } from "./notice-reading";
import { RevealCoverage } from "./reveal-coverage";
import { RevealNoticeDay } from "./reveal-notice-day";
import { RevealReadouts } from "./reveal-readouts";
import { RevealDayOpener, findRevealStart } from "./reveal-start";
import { RevealStructure } from "./reveal-structure";

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
        (failure === "open" || isGuest) && (
          <>
            {failure === "open" && <StepOpenFailed />}
            {isGuest && (
              <SavePlanNote className="text-left lg:text-right" signUpHref={signUpHref} />
            )}
          </>
        )
      }
    >
      <OnboardingSecondaryButton aria-haspopup="dialog" onClick={onAdjust}>
        {t("Adjust plan")}
      </OnboardingSecondaryButton>

      {/* A submit, so a press before the page hydrates starts once it does. */}
      <form action={() => onStart()} className="contents">
        <OnboardingPrimaryButton busy={pending} type="submit">
          {started ? t("Continue") : t("Start")}
        </OnboardingPrimaryButton>
      </form>
    </OnboardingActions>
  );
}

type StartFailure = "open" | "save";

/**
 * What the learner chose, to check before starting: the time a day and where the plan ends, an
 * exam's options, and the lines that only show when the plan needs something from them. Under the
 * title, and beside what the plan holds from 72rem.
 */
function RevealPlan({ onAdjust }: { onAdjust: (section: PlanEditorSection) => void }) {
  const { plan } = usePlanScreen();

  return (
    <div className="flex min-w-0 flex-col gap-5" data-slot="reveal-plan">
      <RevealReadouts />
      <RevealCoverage onAddTime={() => onAdjust("time")} />
      <PlanChoiceLines choices={plan.examChoices} onChange={() => onAdjust("choices")} />
      <RevealNoticeDay />
      {plan.notice === "usual" && <UsualStructureNote />}
    </div>
  );
}

type RevealBodyProps = {
  isGuest: boolean;
  onStart: () => Promise<boolean>;
  reveal: PlanRevealDays | null;
  signUpHref: string;
  syllabus: SyllabusView | null;
};

function RevealColumn({
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
  const { goal } = usePlanScreen();
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

  // Busy until the next page opens; a failed start keeps the learner here.
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

  const planTitleId = useId();
  const adjust = (section: PlanEditorSection) => setEditor({ open: true, section });

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
        <OnboardingRailSection id={planTitleId} title={t("Your plan")}>
          <RevealPlan onAdjust={adjust} />
        </OnboardingRailSection>
      }
    >
      <OnboardingHeading>
        <OnboardingTitle className="text-balance">{t("Your plan is ready")}</OnboardingTitle>
        <OnboardingDescription>{goal.displayName}</OnboardingDescription>
      </OnboardingHeading>

      <div className="min-[72rem]:hidden">
        <RevealPlan onAdjust={adjust} />
      </div>

      <RevealStructure syllabus={syllabus} />

      <PlanEditor
        onOpenChange={(open) => setEditor({ ...editor, open })}
        open={editor.open}
        section={editor.section}
      />
    </OnboardingColumn>
  );
}

/** Start opens the day's next step, and goes to Today only when none can open yet. */
export function RevealBody({
  goalId,
  markRevealed,
  refresh,
  ...props
}: RevealBodyProps & {
  goalId: string;
  markRevealed: () => Promise<boolean>;
  refresh: () => void;
}) {
  return (
    <RevealDayOpener
      goalId={goalId}
      markRevealed={markRevealed}
      refresh={refresh}
      reveal={props.reveal}
    >
      {(openStep) => <RevealColumn {...props} markRevealed={markRevealed} openStep={openStep} />}
    </RevealDayOpener>
  );
}
