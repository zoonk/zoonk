"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  Page,
  PageEyebrow,
  PageHeader,
  PageHeaderContent,
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
  PageTitle,
} from "../_components/page";
import { Surface } from "../_components/surface";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePoll } from "../_utils/use-poll";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { type AlphabetLink, AlphabetRow } from "../language/units/alphabet-row";
import { MindMapsReference } from "../mind-maps/mind-maps-reference";
import {
  PLAN_TITLE_ID,
  type PlanActions,
  type PlanGoal,
  PlanScreenProvider,
  type PlanTutor,
  usePlanScreen,
} from "../plan/plan-context";
import { PlanEditor } from "../plan/plan-editor";
import { PlanNotice } from "../plan/plan-notice";
import { WIDE_PAGE_CLASS } from "../shell/learn-shell";
import { SyllabusSection, hasSyllabusSection } from "../syllabus/syllabus-section";
import {
  ArchiveGoalDialog,
  GoalPausedNotice,
  type GoalStatusControl,
  useSetGoalStatus,
} from "./goal-actions";
import { JourneyHero, type JourneyStanding } from "./journey-hero";
import { type JourneyPathLinks } from "./journey-links";
import { AdjustPlanButton, JourneyMenu } from "./journey-menu";
import { JourneyPath } from "./journey-path";
import { StudyNext } from "./study-next";

export type { PlanActions, PlanChangeOutcome, PlanTutor } from "../plan/plan-context";
export type { JourneyStanding } from "./journey-hero";
export type { GoalStatusControl, GoalStatusOutcome } from "./goal-actions";

/**
 * Stand-ins for lessons still being written are read again this often, so they turn into chapters
 * on their own; outlines take a minute or two each. `usePoll` stops after ten minutes.
 */
const WRITING_REFRESH_MS = 10_000;

/**
 * Where the Journey leads beyond its path: a Library course's page, the focus test and each
 * subject's page.
 */
export type JourneyLinks = JourneyPathLinks & {
  course: (course: { brandSlug: string; courseSlug: string }) => string;
  /** The focus test, offered beside choosing where to focus. */
  focusTest: string;
  /**
   * The goal's mind maps; null until a finished chapter has a map or can get one (its lessons were
   * written), and for a goal whose chapters get none (a language's units).
   */
  mindMaps: string | null;
  subject: (key: string) => string;
};

/** The Library course a plan picks some chapters of, when it has a public page to see all of it. */
function getPartialCourse(plan: PlanView): { brandSlug: string; courseSlug: string } | null {
  const { course } = plan;

  if (!course?.brandSlug || course.planChapterCount === 0) {
    return null;
  }

  return course.planChapterCount < course.chapterCount
    ? { brandSlug: course.brandSlug, courseSlug: course.courseSlug }
    : null;
}

/** Once the plan is done: what to study next, and the host's "Continue at the next level". */
type JourneyNext = { onContinue: () => Promise<boolean>; view: StudyNextView };

type JourneyAlphabet = { link: AlphabetLink; onSkip: () => Promise<boolean> };

/** The current phase still stands in for lessons being written. */
function isPhaseBeingWritten(plan: PlanView): boolean {
  return plan.phases.some(
    (phase) => phase.state === "current" && phase.chapters.some((chapter) => chapter.writing),
  );
}

/**
 * The Journey while the goal's run builds its plan, as Today waits for its first day: the run's
 * progress as it happens, turning into the Journey on its own once the plan is saved (the host
 * reads it again). A run that failed or never started offers "Try again".
 */
export function JourneyBuilding({
  goalTitle,
  onRefresh,
  run,
}: {
  goalTitle: string;
  /** Reads the Journey again: the path shows as soon as the plan exists. */
  onRefresh: () => void;
  run: GenerationRun;
}) {
  const t = useExtracted();

  useRefreshUntilShown({ isReady: run.status === "ready", refresh: onRefresh });

  return (
    <section
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-12"
      data-slot="journey-preparing"
    >
      <GenerationWait kind="curriculum" run={run}>
        <GenerationTimelineTitle>
          {t("Building your plan for {goal}", { goal: goalTitle })}
        </GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t("It usually takes a minute or two. Your plan opens here as soon as it's ready.")}
        </GenerationTimelineDescription>
      </GenerationWait>
    </section>
  );
}

/** "ENEM 2026 · November 8": the goal, and its date when it has one. */
function useJourneyEyebrow(): string {
  const formatDate = useFormatIsoDate();
  const { goal, plan } = usePlanScreen();
  const { targetDate } = plan.schedule;

  return targetDate ? `${goal.title} · ${formatDate(targetDate, "long")}` : goal.title;
}

/** "Phase 2 of 4": where the path is, beside its header; nothing for a path of one phase. */
function PhaseDetail() {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const current = plan.phases.findIndex((phase) => phase.state === "current");

  if (plan.phases.length < 2 || current === -1) {
    return null;
  }

  return (
    <PageSectionDetail>
      {t("Phase {number, number} of {total, number}", {
        number: current + 1,
        total: plan.phases.length,
      })}
    </PageSectionDetail>
  );
}

/** The goal's pause, resume and archive, for its "…", with archiving's confirmation. */
function useGoalMenu(control: GoalStatusControl | null) {
  const [archiving, setArchiving] = useState(false);
  const { setStatus } = useSetGoalStatus(control?.onSetStatus ?? null);

  const archive = () => {
    setArchiving(false);
    setStatus("archived");
  };

  const goal = control && { control, onArchive: () => setArchiving(true), onSetStatus: setStatus };

  return { archive, archiving, goal, setArchiving };
}

function JourneyBody({
  alphabet,
  goalStatus,
  links,
  next,
  standing,
  syllabus,
}: {
  alphabet: JourneyAlphabet | null;
  goalStatus: GoalStatusControl | null;
  links: JourneyLinks;
  next: JourneyNext | null;
  standing: JourneyStanding | null;
  syllabus: SyllabusView | null;
}) {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const [editing, setEditing] = useState(false);
  const goalMenu = useGoalMenu(goalStatus);
  const adjust = () => setEditing(true);
  const partialCourse = getPartialCourse(plan);
  const structure = hasSyllabusSection(syllabus) ? syllabus : null;
  const eyebrow = useJourneyEyebrow();

  const menu = (
    <JourneyMenu
      adjustInMenu={standing === null}
      courseHref={partialCourse && links.course(partialCourse)}
      examHref={links.exam}
      goal={goalMenu.goal}
      onAdjust={adjust}
    />
  );

  return (
    <Page className={cn(structure && WIDE_PAGE_CLASS)} data-slot="journey">
      <PageHeader>
        <PageHeaderContent>
          <PageEyebrow>{eyebrow}</PageEyebrow>
          <PageTitle className="outline-none" id={PLAN_TITLE_ID} tabIndex={-1}>
            {t("Journey")}
          </PageTitle>
        </PageHeaderContent>

        {/* Without a number to stand on, the Journey's "…" stays beside its title. */}
        {!standing && menu}
      </PageHeader>

      <div
        className={cn(
          "flex flex-col gap-8",
          // With a structure, a wide screen puts it beside the path instead of under it.
          structure && "lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10",
        )}
      >
        <div className="flex min-w-0 flex-col gap-8">
          {goalStatus && <GoalPausedNotice control={goalStatus} />}
          {standing && (
            <JourneyHero
              actions={
                <>
                  <AdjustPlanButton onAdjust={adjust} />
                  <span className="ml-auto">{menu}</span>
                </>
              }
              examHref={links.exam}
              standing={standing}
              status={plan.status}
            />
          )}
          <PlanNotice adjustInNotice={standing === null} onAdjust={adjust} />

          <PageSection aria-labelledby="journey-path-title">
            <PageSectionHeader>
              <PageSectionTitle id="journey-path-title">{t("Your path")}</PageSectionTitle>
              <PhaseDetail />
            </PageSectionHeader>

            {alphabet && <AlphabetRow alphabet={alphabet.link} onSkip={alphabet.onSkip} />}

            <Surface className="px-4 pt-4 pb-3">
              <JourneyPath compact={structure !== null} links={links} />
            </Surface>
          </PageSection>
        </div>

        <div className="flex min-w-0 flex-col gap-8 empty:hidden">
          {structure && <SyllabusSection subjectHref={links.subject} syllabus={structure} />}

          {next && (
            <StudyNext courseHref={links.course} next={next.view} onContinue={next.onContinue} />
          )}

          {links.mindMaps && (
            <MindMapsReference
              description={t("The chapters you finished, each in one picture")}
              href={links.mindMaps}
            />
          )}
        </div>
      </div>

      <PlanEditor onOpenChange={setEditing} open={editing} />
      {goalMenu.goal && (
        <ArchiveGoalDialog
          goalTitle={goal.title}
          onArchive={goalMenu.archive}
          onOpenChange={goalMenu.setArchiving}
          open={goalMenu.archiving}
        />
      )}
    </Page>
  );
}

/**
 * The Journey: where the learner is on the way to their goal. Where they stand (one number, its
 * details a tap away), the plan's fit when it needs adjusting, the path of phases to the goal as
 * the finish, the goal's structure (an exam's notice subjects, or the plan's modules) and the
 * mistakes to fix. With a structure, the path is a timeline and each subject's page holds its
 * topics and chapters; without one (a language's units, a plan from one course) the current phase
 * opens to its chapters. The "…" beside the title adjusts the plan and holds what's done now and
 * then; mocks and the mistakes notebook are practiced from Today. The host
 * passes the plan's actions, already bound to the goal, and `refresh`, which reads the plan again
 * while lessons in it are being written.
 */
export function JourneyScreen({
  actions,
  alphabet = null,
  goal,
  goalStatus = null,
  links,
  next = null,
  openFocus = false,
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
  /** Opens "Choose where to focus" on arrival, as the buddy's offer asks. */
  openFocus?: boolean;
  plan: PlanView;
  refresh: () => void;
  shareHref: string;
  /** Null for a goal without a number to stand on yet. */
  standing: JourneyStanding | null;
  /** The goal's subjects or modules; its path then stays a timeline of phases. */
  syllabus?: SyllabusView | null;
  /** The buddy's conversation, for questions about the plan and changes in the learner's words. */
  tutor?: PlanTutor;
}) {
  usePoll({ active: isPhaseBeingWritten(plan), intervalMs: WRITING_REFRESH_MS, onPoll: refresh });

  return (
    <PlanScreenProvider
      value={{ actions, focusTestHref: links.focusTest, goal, openFocus, plan, shareHref, tutor }}
    >
      <JourneyBody
        alphabet={alphabet}
        goalStatus={goalStatus}
        links={links}
        next={next}
        standing={standing}
        syllabus={syllabus}
      />
    </PlanScreenProvider>
  );
}
