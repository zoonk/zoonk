"use client";

import { type PlanChapterView, type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Progress } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleIcon, CirclePlayIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useSkillNames } from "../_utils/skill-names";
import { LearnLink } from "../learn-link";
import { ChapterTestOutLink, canTestOut } from "./chapter-test-out-link";
import { usePlanScreen } from "./plan-context";
import { usePhaseTitle } from "./use-phase-name";
import { useStudySize } from "./use-plan-estimate";

const CHAPTER_ICONS = {
  current: CirclePlayIcon,
  done: CircleCheckIcon,
  upcoming: CircleIcon,
} as const;

/**
 * A chapter's title, linked to its page when the host has chapter pages. Lessons still being
 * written show under their course's title until their chapters exist; skills placement tested out
 * before then show by name, since the learner knows them, not the whole course.
 */
function ChapterTitle({ chapter }: { chapter: PlanChapterView }) {
  const t = useExtracted();
  const skillNames = useSkillNames();
  const { chapterBasePath } = usePlanScreen();

  if (chapter.skills.length > 0) {
    return skillNames(chapter.skills);
  }

  if (chapter.writing || !chapter.chapterId) {
    return chapter.title || t("More lessons");
  }

  if (!chapterBasePath || !chapter.chapterId) {
    return chapter.title;
  }

  return (
    <LearnLink
      className="-my-3 inline-block py-3 underline-offset-4 hover:underline"
      href={`${chapterBasePath}/${chapter.chapterId}`}
    >
      {chapter.title}
    </LearnLink>
  );
}

function ChapterRow({ chapter }: { chapter: PlanChapterView }) {
  const t = useExtracted();
  const Icon = CHAPTER_ICONS[chapter.state];

  // The icon and "Test out" sit on the title's first line when a long title wraps.
  return (
    <li className="flex items-start gap-3 py-3" data-state={chapter.state}>
      <LineMarker aria-hidden="true" className="text-sm">
        <Icon
          className={cn(
            "size-4",
            chapter.state === "done" ? "text-success" : "text-muted-foreground",
            chapter.state === "current" && "text-foreground",
          )}
        />
      </LineMarker>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "text-sm",
            chapter.state === "done" && "text-muted-foreground",
            chapter.state === "current" && "font-medium",
          )}
        >
          <ChapterTitle chapter={chapter} />
        </span>

        {chapter.writing && (
          <span className="text-muted-foreground text-xs">{t("Lessons being written")}</span>
        )}

        {chapter.testedOut && (
          <span className="text-muted-foreground text-xs">{t("You already know this")}</span>
        )}

        {chapter.state === "current" && !chapter.writing && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {t(
              "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
              { done: chapter.lessonsDone, total: chapter.lessonsTotal },
            )}
          </span>
        )}
      </span>

      {canTestOut(chapter) && (
        <ChapterTestOutLink
          chapter={chapter}
          // A 44px target centered on the title's 20px first line.
          className="text-muted-foreground hover:text-foreground -my-3 px-2 text-xs font-medium underline-offset-4 hover:underline"
        >
          {t("Test out")}
        </ChapterTestOutLink>
      )}
    </li>
  );
}

function usePhaseWhen() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function phaseWhen(phase: PlanPhaseView): string | null {
    if (phase.state === "done") {
      return t("Done");
    }

    // A plan for a test days away counts in days, so its phases say the weekday.
    if (phase.state === "current" && phase.endDate) {
      return t("By {date}", { date: formatDate(phase.endDate, phase.short ? "weekday" : "long") });
    }

    return phase.startDate
      ? t("Starting {date}", {
          date: formatDate(phase.startDate, phase.short ? "weekday" : "month"),
        })
      : null;
  };
}

/**
 * The current phase opens chapter by chapter, with a test-out for chapters the learner may know,
 * and ends with the tools it uses.
 */
function CurrentPhase({ phase, tools }: { phase: PlanPhaseView; tools?: React.ReactNode }) {
  const t = useExtracted();
  const locale = useLocale();
  const phaseTitle = usePhaseTitle();
  const phaseWhen = usePhaseWhen();
  const when = phaseWhen(phase);
  const doneChapters = phase.chapters?.filter((chapter) => chapter.state === "done").length ?? 0;

  return (
    <li
      className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-2xl p-4 ring-1"
      data-state="current"
    >
      <div className="flex flex-col gap-0.5">
        {/* The tab panel sits right under the page's h1, so the phase is the next level. */}
        <h2 className="font-semibold">{phaseTitle(phase)}</h2>
        <p className="text-muted-foreground text-sm">
          {[
            when,
            t(
              "{total, plural, one {{done, number} of # chapter} other {{done, number} of # chapters}}",
              { done: doneChapters, total: phase.chapterCount },
            ),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <Progress
        locale={locale}
        aria-label={t("Lessons done in this phase")}
        className="**:data-[slot=progress-track]:h-1.5"
        value={phase.lessonsTotal > 0 ? (phase.lessonsDone / phase.lessonsTotal) * 100 : 0}
      />

      {phase.milestone && (
        <p className="text-muted-foreground text-sm">
          {t("Milestone: {milestone}", { milestone: phase.milestone })}
        </p>
      )}

      {phase.chapters && (
        <ul className="flex flex-col">
          {phase.chapters.map((chapter, index) => (
            <ChapterRow chapter={chapter} key={chapter.chapterId ?? index} />
          ))}
        </ul>
      )}

      {tools}
    </li>
  );
}

/** Other phases stay one line: their size and when they arrive. */
function OtherPhase({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const phaseTitle = usePhaseTitle();
  const studySize = useStudySize();
  const phaseWhen = usePhaseWhen();
  const when = phaseWhen(phase);

  return (
    <li
      className="border-border flex items-start gap-3 rounded-2xl border px-4 py-3"
      data-state={phase.state}
    >
      {/* The number sits on the title's first line when the title or its details wrap. */}
      <LineMarker aria-hidden="true" className="text-sm">
        <span
          className={cn(
            "bg-muted flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            phase.state === "done" && "bg-success/15 text-success",
          )}
        >
          {phase.index + 1}
        </span>
      </LineMarker>
      <div className="flex min-w-0 flex-col">
        <span
          className={cn("text-sm font-medium", phase.state === "done" && "text-muted-foreground")}
        >
          {phaseTitle(phase)}
        </span>
        <span className="text-muted-foreground text-xs">
          {[
            phase.chapterCount > 0 &&
              t("{count, plural, one {# chapter} other {# chapters}}", {
                count: phase.chapterCount,
              }),
            studySize(phase.hours),
            when,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </li>
  );
}

/**
 * The whole plan: every phase, with only the current one in detail. `tools` ends the current
 * phase: the tools that phase uses (`PlanTools`).
 */
export function PlanPhases({ tools }: { tools?: React.ReactNode }) {
  const { plan } = usePlanScreen();

  return (
    <ol className="flex flex-col gap-2">
      {plan.phases.map((phase) =>
        phase.state === "current" ? (
          <CurrentPhase key={phase.index} phase={phase} tools={tools} />
        ) : (
          <OtherPhase key={phase.index} phase={phase} />
        ),
      )}
    </ol>
  );
}
