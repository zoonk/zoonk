"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
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

/**
 * Stand-ins for lessons still being written are read again this often, so they turn into chapters
 * on their own; outlines take a minute or two each. `usePoll` stops after ten minutes.
 */
const WRITING_REFRESH_MS = 10_000;

/** From 72rem the numbers, the slot and the plan's settings live in the aside instead. */
const IN_COLUMN_CLASS = "min-[72rem]:hidden";
const IN_ASIDE_CLASS = "hidden min-[72rem]:flex";
const IN_ASIDE_GRID_CLASS = "hidden min-[72rem]:grid";

/**
 * Where the Plan leads beyond its path: a Library course's page, the focus test, each subject's
 * page, the goal's mind maps and last week's recap.
 */
export type JourneyLinks = JourneyPathLinks & {
  course: (course: { brandSlug: string; courseSlug: string }) => string;
  /** The focus test, offered beside choosing where to focus. */
  focusTest: string;
  /** Last week's recap, from "Your pace"; null on a host without it. */
  logbook: string | null;
  /**
   * The goal's mind maps; null until a finished chapter has a map or can get one (its lessons were
   * written), and for a goal whose chapters get none (a language's units).
   */
  mindMaps: string | null;
  subject: (key: string) => string;
};

/** Once the plan is done: what to study next, and the host's "Continue at the next level". */
type JourneyNext = { onContinue: () => Promise<boolean>; view: StudyNextView };

type JourneyAlphabet = { link: AlphabetLink; onSkip: () => Promise<boolean> };

/**
 * The current phase still stands in for lessons on the way. Topics after the weeks the plan writes
 * ahead (`far`) aren't being written: nothing would change by reading them again.
 */
function isPhaseBeingWritten(plan: PlanView): boolean {
  return plan.phases.some(
    (phase) =>
      phase.state === "current" &&
      phase.chapters.some((chapter) => chapter.writing && !chapter.far),
  );
}

/**
 * The Plan while the goal's run builds it, as Today waits for its first day: the page's own
 * header, whose eyebrow says the plan is being built (the wait under it has no title of its own,
 * so the page keeps one), then the run's progress as it happens, turning into the Plan on its own
 * once it's saved (the host reads it again). A run that failed or never started offers "Try again".
 */
export function JourneyBuilding({
  goalTitle,
  onRefresh,
  run,
}: {
  goalTitle: string;
  /** Reads the Plan again: it shows as soon as it exists. */
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

/**
 * The goal's pause, resume and archive, for its "…", with archiving's confirmation, and resuming's
 * when it changes the plan (see `ResumeGoalDialog`).
 */
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

/**
 * "Adjust plan", opened at one of its settings or from its top. Until the learner opens or closes
 * it, an arrival says: from its top (`true`) or at the setting it names, as Today's "more time"
 * opens it at the time a day.
 */
function usePlanEditor(arrival: boolean | PlanEditorSection) {
  const at = typeof arrival === "string" ? arrival : null;
  const arrived = { open: arrival !== false, section: at };
  const [editor, setEditor] = useState<typeof arrived | null>(null);

  // Activity preserves state when the page hides. A later arrival starts from its requested view,
  // while closing the editor still sticks for as long as the learner stays on the Plan.
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
  syllabus: SyllabusView | null;
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

/**
 * The Plan: where the learner is on the way to their goal. Under the title (with "Adjust plan" and
 * the "…" of what's done now and then beside it) the phases in time as a roadmap, then the goal's
 * structure (an exam's notice subjects, the plan's modules) or, for a goal without one (a
 * language's units, a plan from one course), its path. Beside them from 72rem, in the aside: the
 * two numbers that answer "will I make it?", the one thing the Plan wants the learner to know or
 * decide, what comes next on the path and the plan's settings; on smaller screens the numbers and
 * that one thing follow the roadmap, and the rest follows the page. The host passes the plan's
 * actions, already bound to the goal, and `refresh`, called every few seconds while lessons in it
 * are being written: the host reads the plan again once they changed.
 */
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
  /** A language whose script isn't Latin: its alphabet lesson, first on the path. */
  alphabet?: JourneyAlphabet | null;
  goal: PlanGoal;
  /** The goal's status and how its "…" pauses, resumes or archives it; null leaves them out. */
  goalStatus?: GoalStatusControl | null;
  links: JourneyLinks;
  next?: JourneyNext | null;
  /**
   * Opens the plan editor on arrival, as Today's fewer-lessons notice offers, or at one of its
   * settings, as Today's falling-behind "more time" opens it at the time a day.
   */
  openAdjust?: boolean | PlanEditorSection;
  /** Opens "Choose where to focus" on arrival, as the buddy's offer asks. */
  openFocus?: boolean;
  /** Opens "Study everything" on arrival, as Today's offer asks. */
  openFullCourse?: boolean;
  plan: PlanView;
  refresh: () => unknown;
  shareHref: string;
  /** Null for a goal without a number to stand on yet. */
  standing: JourneyStanding | null;
  /** The goal's subjects or modules; its path then shows on the roadmap and in "Next on your path". */
  syllabus?: SyllabusView | null;
  /** The buddy's conversation, for questions about the plan and changes in the learner's words. */
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
