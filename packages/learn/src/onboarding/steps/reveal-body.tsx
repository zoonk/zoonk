"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { CelebrationScope, useCelebration } from "@zoonk/ui/hooks/celebration";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { PageSectionTitle } from "../../_components/page";
import { ChangeSaveError } from "../../_components/save-error";
import { SuccessEyebrow } from "../../_components/success-eyebrow";
import { type LearnBuddy, resolveLearnBuddy } from "../../buddies/use-buddy-name";
import { PlanChoiceLines } from "../../plan/plan-choice-lines";
import { PlanChoices } from "../../plan/plan-choices";
import { usePlanScreen } from "../../plan/plan-context";
import { PlanEditor } from "../../plan/plan-editor";
import { type PlanEditorSection } from "../../plan/plan-editor-sections";
import { isFinished } from "../../today/today-queue";
import { OnboardingColumn, OnboardingTitle } from "../onboarding-frame";
import { SavePlanNote } from "../save-plan-note";
import { UsualStructureNote } from "./notice-reading";
import { AreaWeights, PlanChapterList, PlanPhasesBar } from "./plan-shape";
import { RevealCoverage } from "./reveal-coverage";
import { RevealToday, RevealWeek } from "./reveal-days";
import { RevealNoticeDay } from "./reveal-notice-day";
import { RevealReadouts } from "./reveal-readouts";

/** Zu cheers on the moment's last beat, after the check, the count and "Start here". */
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

/**
 * Pinned to the bottom on phones and tablets, where the plan scrolls under it, and beside the hero
 * from `lg`. Start works from the moment's first frame.
 */
function RevealActions({
  isGuest,
  onAdjust,
  onStart,
  signUpHref,
  started,
}: {
  isGuest: boolean;
  onAdjust: () => void;
  onStart: () => Promise<boolean>;
  signUpHref: string;
  started: boolean;
}) {
  const t = useExtracted();
  const startRef = useEnterClick<HTMLButtonElement>();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setPending(true);
    setFailed(false);

    // Busy until the next page opens; a failed save keeps the learner here to try again.
    if (!(await onStart())) {
      setPending(false);
      setFailed(true);
    }
  };

  return (
    <div
      className={cn(
        "bg-background sticky bottom-0 -mx-4 flex flex-col gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "lg:static lg:col-2! lg:row-start-1 lg:mx-0 lg:w-56 lg:self-start lg:border-t-0 lg:p-0",
      )}
      data-slot="reveal-actions"
    >
      {failed && <ChangeSaveError />}

      <div className="flex gap-2 lg:flex-col-reverse">
        <Button className="flex-1 lg:flex-none" onClick={onAdjust} size="lg" variant="outline">
          {t("Adjust")}
        </Button>

        <Button
          aria-keyshortcuts="Enter"
          busy={pending}
          className="flex-2 font-[560] lg:flex-none"
          icon={<PlayIcon aria-hidden="true" />}
          onClick={start}
          ref={startRef}
          size="lg"
        >
          {started ? t("Continue") : t("Start")}
          <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
        </Button>
      </div>

      {isGuest && <SavePlanNote signUpHref={signUpHref} />}
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

export function RevealBody({
  buddy,
  isGuest,
  moment,
  onStart,
  reveal,
  signUpHref,
  syllabus,
}: {
  buddy: LearnBuddy | null;
  isGuest: boolean;
  /** False once the learner pressed Start: a reveal they open again shows its end, still. */
  moment: boolean;
  onStart: () => Promise<boolean>;
  signUpHref: string;
  reveal: PlanRevealDays | null;
  syllabus: SyllabusView | null;
}) {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const started = reveal?.today.blocks.some((block) => isFinished(block)) ?? false;

  const [editor, setEditor] = useState<{ open: boolean; section: PlanEditorSection | null }>({
    open: false,
    section: null,
  });

  return (
    <CelebrationScope play={moment}>
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
              <OnboardingTitle className="text-balance">{goal.title}</OnboardingTitle>
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

        <RevealToday reveal={reveal} />
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
          onStart={onStart}
          signUpHref={signUpHref}
          started={started}
        />
      </OnboardingColumn>
    </CelebrationScope>
  );
}
