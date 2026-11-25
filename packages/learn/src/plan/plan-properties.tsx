"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { LANGUAGE_ACTIVITY_TYPES } from "@zoonk/core/language/activities";
import { type MockScheduleView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { useExtracted } from "next-intl";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { useFormatDuration } from "../_utils/time-format";
import { type LessonVariety, getLessonVarietyName } from "../country/use-country-lines";
import { useRoadmapFinish, useRoadmapPhases } from "../journey/use-roadmap";
import { useVarietyName } from "../language-variety/use-variety-words";
import { LearnLink } from "../learn-link";
import { useActivityName } from "./plan-activities";
import { usePlanScreen } from "./plan-context";
import { PlanDateText } from "./plan-date-text";
import { type PlanEditorSection } from "./plan-editor-sections";
import { usePickedNames } from "./use-picked-names";
import { useStudyDaysText } from "./use-study-days-text";

const TITLE_ID = "plan-properties-title";

function mono(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

/**
 * The time a day in the "Daily study time" setting's words. Alone in that row the time is a value,
 * in the data face; anywhere else it says "a day". A phrase is in the words' face throughout.
 */
export function DailyTimeValue({ perDay = false }: { perDay?: boolean }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const { shape } = plan.schedule;
  const weekdays = formatDuration(shape.weekdays);

  if (shape.weekend !== null) {
    return t("{weekdays} · {weekend} weekends", {
      weekdays,
      weekend: formatDuration(shape.weekend),
    });
  }

  return perDay ? t("{time} a day", { time: weekdays }) : mono(weekdays);
}

const PROPERTY_ROW_CLASS =
  "hover:bg-muted focus-visible:ring-ring/50 min-h-control -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 text-left text-compact transition-colors outline-none focus-visible:ring-[3px]";

function PropertyRowParts({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <>
      <span className="text-muted-foreground max-w-[60%] shrink-0 truncate">{label}</span>
      <span className="min-w-0 py-1 text-right text-balance">{children}</span>
    </>
  );
}

function PropertyRow({
  children,
  label,
  onOpen,
}: {
  children: React.ReactNode;
  label: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button aria-haspopup="dialog" className={PROPERTY_ROW_CLASS} onClick={onOpen} type="button">
        <PropertyRowParts label={label}>{children}</PropertyRowParts>
      </button>
    </li>
  );
}

/** Not a control: what it says is decided elsewhere, so it reads as one label with its value. */
function ReadOnlyRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <li className={cn(PROPERTY_ROW_CLASS, "hover:bg-transparent")}>
      <PropertyRowParts label={label}>{children}</PropertyRowParts>
    </li>
  );
}

function LessonLanguageRow({ variety }: { variety: LessonVariety }) {
  const t = useExtracted();

  return <ReadOnlyRow label={t("Lesson language")}>{getLessonVarietyName(variety)}</ReadOnlyRow>;
}

/** Content or exam country, then the lessons' language where it could surprise; one slot with Language. */
function CountryRows({ onOpen }: { onOpen: () => void }) {
  const t = useExtracted();
  const { contentCountry, examplesCountry } = usePlanScreen().goal;

  if (examplesCountry) {
    return <ReadOnlyRow label={t("Country")}>{examplesCountry.name}</ReadOnlyRow>;
  }

  if (!contentCountry) {
    return null;
  }

  return (
    <>
      {contentCountry.editable ? (
        <PropertyRow label={t("Country")} onOpen={onOpen}>
          {contentCountry.name}
        </PropertyRow>
      ) : (
        <ReadOnlyRow label={contentCountry.kind === "exam" ? t("Exam country") : t("Country")}>
          {contentCountry.name}
        </ReadOnlyRow>
      )}
      {contentCountry.lessonVariety && <LessonLanguageRow variety={contentCountry.lessonVariety} />}
    </>
  );
}

function ExamChoiceRow({ choice, onOpen }: { choice: ExamChoiceView; onOpen: () => void }) {
  const t = useExtracted();
  const picked = usePickedNames(choice);

  return (
    <PropertyRow label={choice.group} onOpen={onOpen}>
      <span className={cn(!picked && "text-warning-text font-medium")}>
        {picked ?? t("Choose")}
      </span>
    </PropertyRow>
  );
}

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function MockScheduleValue({ mocks }: { mocks: MockScheduleView }) {
  const t = useExtracted();
  const weekday = mocks.weekday === null ? null : WEEKDAY_KEYS[mocks.weekday];

  if (weekday) {
    const days = t(
      "{weekday, select, sunday {Sundays} monday {Mondays} tuesday {Tuesdays} wednesday {Wednesdays} thursday {Thursdays} friday {Fridays} saturday {Saturdays} other {}}",
      { weekday },
    );

    return mocks.everyWeeks && mocks.everyWeeks > 1
      ? t("{days}, every {weeks, plural, one {# week} other {# weeks}}", {
          days,
          weeks: mocks.everyWeeks,
        })
      : days;
  }

  if (mocks.count <= 1) {
    return <PlanDateText isoDate={mocks.nextDate} />;
  }

  const date = <PlanDateText inWords isoDate={mocks.nextDate} />;
  return t.rich("Next <date></date>", { date: () => date });
}

/** Mock exams aren't a setting, so the row opens the exam's page, where they are. */
function MockExamsRow({ examHref, mocks }: { examHref: string | null; mocks: MockScheduleView }) {
  const t = useExtracted();

  const parts = (
    <PropertyRowParts label={t("Mock exams")}>
      <MockScheduleValue mocks={mocks} />
    </PropertyRowParts>
  );

  return (
    <li>
      {examHref ? (
        <LearnLink className={PROPERTY_ROW_CLASS} href={examHref}>
          {parts}
        </LearnLink>
      ) : (
        <div className={cn(PROPERTY_ROW_CLASS, "hover:bg-transparent")}>{parts}</div>
      )}
    </li>
  );
}

/** The finish the plan works out when the learner set no end date. */
function useEstimatedFinish() {
  const { goal, plan } = usePlanScreen();
  const finish = useRoadmapFinish();

  return goal.kind !== "exam" && !plan.end && !plan.schedule.targetDate ? finish : null;
}

/** The date the learner set, never the day a finished plan was done. */
function GoalDateValue() {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (!targetDate) {
    return goal.kind === "exam" ? t("To be confirmed") : t("None set");
  }

  return (
    <PlanDateText
      estimate={targetDateEstimated}
      isoDate={targetDate}
      month={targetDateNamedMonth}
    />
  );
}

/**
 * The path's last row and the timeline's flag date the estimated finish. A plan of subjects with
 * one phase shows neither (no path list, no timeline), so its own row says it.
 */
function EstimatedFinishRow({ pathShown }: { pathShown: boolean }) {
  const t = useExtracted();
  const finish = useEstimatedFinish();
  const { phases } = useRoadmapPhases();

  if (!finish || pathShown || phases.length > 1) {
    return null;
  }

  return (
    <ReadOnlyRow label={t("Estimated finish")}>
      <PlanDateText estimate={finish.estimate} isoDate={finish.isoDate} month={finish.month} />
    </ReadOnlyRow>
  );
}

export function PlanProperties({
  className,
  examHref = null,
  onOpen,
  pathShown,
}: {
  className?: string;
  examHref?: string | null;
  onOpen: (section: PlanEditorSection) => void;
  /** The page lists the path, whose last row dates the finish. */
  pathShown: boolean;
}) {
  const t = useExtracted();
  const activityName = useActivityName();
  const studyDaysText = useStudyDaysText();
  const varietyName = useVarietyName();
  const { goal, paused, plan } = usePlanScreen();
  const skipped = new Set(plan.steering.skippedActivities);
  const practiced = LANGUAGE_ACTIVITY_TYPES.filter((activity) => !skipped.has(activity));

  return (
    <PageSection aria-labelledby={TITLE_ID} className={className} data-slot="plan-properties">
      <PageSectionHeader>
        <PageSectionTitle id={TITLE_ID}>{t("Your plan")}</PageSectionTitle>
      </PageSectionHeader>

      <ul className="flex flex-col">
        <PropertyRow
          label={goal.kind === "exam" ? t("Exam date") : t("End date")}
          onOpen={() => onOpen("date")}
        >
          <GoalDateValue />
        </PropertyRow>

        <EstimatedFinishRow pathShown={pathShown} />

        <PropertyRow label={t("Daily study time")} onOpen={() => onOpen("time")}>
          <DailyTimeValue />
        </PropertyRow>

        <PropertyRow label={t("Study days")} onOpen={() => onOpen("days")}>
          {studyDaysText(plan.schedule.weekdayMinutes)}
        </PropertyRow>

        {!paused && plan.schedule.mocks && (
          <MockExamsRow examHref={examHref} mocks={plan.schedule.mocks} />
        )}

        {plan.examChoices.map((choice) => (
          <ExamChoiceRow choice={choice} key={choice.group} onOpen={() => onOpen("choices")} />
        ))}

        {goal.country && (
          <PropertyRow label={t("Language")} onOpen={() => onOpen("language")}>
            {varietyName(goal.country)}
          </PropertyRow>
        )}

        <CountryRows onOpen={() => onOpen("country")} />

        {goal.kind === "language" && practiced.length > 0 && (
          <PropertyRow label={t("Practice")} onOpen={() => onOpen("practice")}>
            {practiced.length === LANGUAGE_ACTIVITY_TYPES.length
              ? t("All activities")
              : practiced.map((activity) => activityName(activity)).join(FACT_SEPARATOR)}
          </PropertyRow>
        )}
      </ul>
    </PageSection>
  );
}
