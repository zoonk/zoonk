"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useState } from "react";
import { Page, PageEyebrow, PageHeaderContent, PageTitle } from "../_components/page";
import { usePoll } from "../_utils/use-poll";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { type AlphabetLink } from "../language/units/alphabet-row";
import {
  type PlanActions,
  type PlanGoal,
  PlanScreenProvider,
  type PlanTutor,
  usePlanScreen,
} from "../plan/plan-context";
import { PlanEditor } from "../plan/plan-editor";
import { type PlanEditorSection } from "../plan/plan-editor-sections";
import { PlanProperties } from "../plan/plan-properties";
import { PlanSheetHosts } from "../plan/plan-sheet-hosts";
import { PlanSuggestionProvider, PlanSuggestionSlot } from "../plan/plan-suggestion";
import { PageWithAside } from "../shell/learn-shell";
import { SyllabusSection, hasSyllabusSection } from "../syllabus/syllabus-section";
import { type SyllabusSectionView } from "../syllabus/syllabus-section-view";
import {
  ArchiveGoalDialog,
  type GoalStatusChange,
  type GoalStatusControl,
  ResumeGoalDialog,
  useSetGoalStatus,
} from "./goal-actions";
import { type JourneyStanding, PlanNumbers } from "./journey-hero";
import { type JourneyPathLinks, getPartialCourse } from "./journey-links";
import { AdjustPlanButton, JourneyMenu } from "./journey-menu";
import { NextOnPath } from "./next-on-path";
import { PlanHeader } from "./plan-header";
import { PlanRoadmap } from "./plan-roadmap";
import { MoreSection, PathSection, PhasesSheet } from "./plan-sections";

export type { PlanActions, PlanChangeOutcome, PlanTutor } from "../plan/plan-context";
export type { JourneyStanding } from "./journey-hero";
export type { GoalStatusControl, GoalStatusOutcome } from "./goal-actions";

const WRITING_REFRESH_MS = 10_000;

const IN_COLUMN_CLASS = "min-[72rem]:hidden";
const IN_ASIDE_CLASS = "hidden min-[72rem]:flex";
const IN_ASIDE_GRID_CLASS = "hidden min-[72rem]:grid";

export type JourneyLinks = JourneyPathLinks & {
  course: (course: { brandSlug: string; courseSlug: string }) => string;
  focusTest: string;
  logbook: string | null;
  mindMaps: string | null;
  subject: (key: string) => string;
};

type JourneyNext = { onContinue: () => Promise<boolean>; view: StudyNextView };

type JourneyAlphabet = { link: AlphabetLink; onSkip: () => Promise<boolean> };

/** Far topics aren't being written, so reading them again would change nothing. */
function isPhaseBeingWritten(plan: PlanView): boolean {
  return plan.phases.some(
    (phase) =>
      phase.state === "current" &&
      phase.chapters.some((chapter) => chapter.writing && !chapter.far),
  );
}

export function JourneyBuilding({
  goalTitle,
  onRefresh,
  run,
}: {
  goalTitle: string;
  onRefresh: () => void;
  run: GenerationRun;
}) {
  const t = useExtracted();

  useRefreshUntilShown({ isReady: run.status === "ready", refresh: onRefresh });

  return (
    <Page data-slot="journey-preparing">
      <PageHeaderContent>
        <PageEyebrow>{t("{goal} · Building your plan", { goal: goalTitle })}</PageEyebrow>
        <PageTitle>{t("Plan")}</PageTitle>
      </PageHeaderContent>

      <section className="flex max-w-xl flex-col gap-8">
        <GenerationWait kind="curriculum" run={run}>
          <GenerationTimelineDescription>
            {t("It usually takes a minute or two. Your plan opens here as soon as it's ready.")}
          </GenerationTimelineDescription>
        </GenerationWait>
      </section>
    </Page>
  );
}

function useGoalMenu(control: GoalStatusControl | null) {
  const [archiving, setArchiving] = useState(false);
  const [resuming, setResuming] = useState(false);
  const { setStatus } = useSetGoalStatus(control?.onSetStatus ?? null);
  const resumePreview = control?.resume ?? false;

  const archive = () => {
    setArchiving(false);
    setStatus("archived");
  };

  const resume = () => {
    setResuming(false);
    setStatus("active");
  };

  const onSetStatus = (status: GoalStatusChange) => {
    if (status === "active" && resumePreview) {
      setResuming(true);
      return;
    }

    setStatus(status);
  };

  const goal = control && { control, onArchive: () => setArchiving(true), onSetStatus };

  return { archive, archiving, goal, resume, resumePreview, resuming, setArchiving, setResuming };
}

function usePlanEditor(arrival: boolean | PlanEditorSection) {
  const at = typeof arrival === "string" ? arrival : null;
  const arrived = { open: arrival !== false, section: at };
  const [editor, setEditor] = useState<typeof arrived | null>(null);

  // Activity keeps state while the page hides, so a later arrival starts from its requested view.
  useLayoutEffect(() => () => setEditor(null), []);

  return {
    editor: editor ?? arrived,
    open: (section: PlanEditorSection | null = null) => setEditor({ open: true, section }),
    setOpen: (open: boolean) => setEditor({ open, section: (editor ?? arrived).section }),
  };
}

function JourneyBody({
  alphabet,
  goalStatus,
  links,
  next,
  openAdjust,
  standing,
  syllabus,
}: {
  alphabet: JourneyAlphabet | null;
  goalStatus: GoalStatusControl | null;
  links: JourneyLinks;
  next: JourneyNext | null;
  openAdjust: boolean | PlanEditorSection;
  standing: JourneyStanding | null;
  syllabus: SyllabusSectionView | null;
}) {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const editor = usePlanEditor(openAdjust);
  const [phasesOpen, setPhasesOpen] = useState(false);
  const goalMenu = useGoalMenu(goalStatus);
  const partialCourse = getPartialCourse(plan);
  const structure = hasSyllabusSection(syllabus) ? syllabus : null;
  const paused = goalStatus?.status === "paused";

  const numbers = (variant: "stats" | "tiles", className: string) =>
    standing && (
      <PlanNumbers
        className={className}
        examHref={links.exam}
        logbookHref={links.logbook}
        onAdjust={() => editor.open()}
        paused={paused}
        standing={standing}
        status={plan.status}
        variant={variant}
      />
    );

  return (
    <PlanSuggestionProvider
      host={{
        courseHref: links.course,
        goalStatus,
        next,
        onAdjust: () => editor.open(),
        onEdit: editor.open,
      }}
    >
      <PageWithAside
        aside={
          <>
            {numbers("stats", IN_ASIDE_GRID_CLASS)}
            <PlanSuggestionSlot className="hidden min-[72rem]:block" />
            <NextOnPath links={links} />
            <MoreSection links={links} />
            <PlanProperties className={IN_ASIDE_CLASS} examHref={links.exam} onOpen={editor.open} />
          </>
        }
        asideClassName="sm:max-[72rem]:grid sm:max-[72rem]:grid-cols-2 sm:max-[72rem]:items-start sm:max-[72rem]:gap-x-10"
        asideLabel={t("Your plan at a glance")}
      >
        <Page data-slot="journey">
          <PlanHeader>
            <AdjustPlanButton onAdjust={() => editor.open()} />
            <JourneyMenu
              courseHref={partialCourse && links.course(partialCourse)}
              examHref={links.exam}
              goal={goalMenu.goal}
            />
          </PlanHeader>

          <PlanRoadmap
            className="sm:hidden"
            density="compact"
            onOpen={structure ? () => setPhasesOpen(true) : null}
          />
          <PlanRoadmap className="hidden sm:flex" density="full" links={links} />

          {numbers("tiles", IN_COLUMN_CLASS)}
          <PlanSuggestionSlot className={IN_COLUMN_CLASS} />

          {structure ? (
            <SyllabusSection subjectHref={links.subject} syllabus={structure} />
          ) : (
            <PathSection alphabet={alphabet} links={links} />
          )}
        </Page>

        <PlanEditor
          onOpenChange={editor.setOpen}
          open={editor.editor.open}
          section={editor.editor.section}
        />
        {structure && <PhasesSheet links={links} onOpenChange={setPhasesOpen} open={phasesOpen} />}
        {goalMenu.goal && (
          <ArchiveGoalDialog
            goalTitle={goal.title}
            onArchive={goalMenu.archive}
            onOpenChange={goalMenu.setArchiving}
            open={goalMenu.archiving}
          />
        )}
        {goalMenu.resumePreview && (
          <ResumeGoalDialog
            goalTitle={goal.title}
            onOpenChange={goalMenu.setResuming}
            onResume={goalMenu.resume}
            open={goalMenu.resuming}
          />
        )}
      </PageWithAside>
    </PlanSuggestionProvider>
  );
}

export function JourneyScreen({
  actions,
  alphabet = null,
  goal,
  goalStatus = null,
  links,
  next = null,
  openAdjust = false,
  openFocus = false,
  openFullCourse = false,
  plan,
  refresh,
  shareHref,
  standing,
  syllabus = null,
  tutor,
}: {
  actions: PlanActions;
  alphabet?: JourneyAlphabet | null;
  goal: PlanGoal;
  goalStatus?: GoalStatusControl | null;
  links: JourneyLinks;
  next?: JourneyNext | null;
  openAdjust?: boolean | PlanEditorSection;
  openFocus?: boolean;
  openFullCourse?: boolean;
  plan: PlanView;
  refresh: () => unknown;
  shareHref: string;
  standing: JourneyStanding | null;
  syllabus?: SyllabusSectionView | null;
  tutor?: PlanTutor;
}) {
  usePoll({
    active: isPhaseBeingWritten(plan),
    intervalMs: WRITING_REFRESH_MS,
    onPoll: refresh,
    startNow: false,
  });

  return (
    <PlanScreenProvider
      value={{ actions, focusTestHref: links.focusTest, goal, openFocus, plan, shareHref, tutor }}
    >
      <PlanSheetHosts openFullCourse={openFullCourse}>
        <JourneyBody
          alphabet={alphabet}
          goalStatus={goalStatus}
          links={links}
          next={next}
          openAdjust={openAdjust}
          standing={standing}
          syllabus={syllabus}
        />
      </PlanSheetHosts>
    </PlanScreenProvider>
  );
}
