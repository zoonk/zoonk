"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { LANGUAGE_ACTIVITY_TYPES } from "@zoonk/core/language/activities";
import { type MockScheduleView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { useFormatDuration } from "../_utils/time-format";
import { type LessonVariety, getLessonVarietyName } from "../country/use-country-lines";
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

function DailyTimeValue() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const { shape } = plan.schedule;

  if (shape.weekend === null) {
    return mono(formatDuration(shape.weekdays));
  }

  return t.rich("<mono>{weekdays}</mono> · <mono>{weekend}</mono> weekends", {
    mono,
    weekdays: formatDuration(shape.weekdays),
    weekend: formatDuration(shape.weekend),
  });
}

const PROPERTY_ROW_CLASS =
  "hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 text-left text-[0.8125rem] transition-colors outline-none focus-visible:ring-[3px]";

function PropertyRowParts({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <>
      <span className="text-muted-foreground max-w-[60%] shrink-0 truncate">{label}</span>
      <span className="line-clamp-2 min-w-0 py-1 text-right text-balance">{children}</span>
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
      <button className={PROPERTY_ROW_CLASS} onClick={onOpen} type="button">
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
    return <ReadOnlyRow label={t("Lesson examples")}>{examplesCountry.name}</ReadOnlyRow>;
  }

  if (!contentCountry) {
    return null;
  }

  return (
    <>
      {contentCountry.editable ? (
        <PropertyRow label={t("Content country")} onOpen={onOpen}>
          {contentCountry.name}
        </PropertyRow>
      ) : (
        <ReadOnlyRow
          label={contentCountry.kind === "exam" ? t("Exam country") : t("Content country")}
        >
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

  const date = <PlanDateText isoDate={mocks.nextDate} />;

  return mocks.count > 1 ? t.rich("Next <date></date>", { date: () => date }) : date;
}

/** Mock exams aren't a setting, so the row opens the exam's page, where they are. */
function MockExamsRow({ examHref, mocks }: { examHref: string | null; mocks: MockScheduleView }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();

  const parts = (
    <PropertyRowParts label={t("Mock exams")}>
      {plan.access.mocksRequirePlus && <PlusMark className="mr-2 align-middle" />}
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

function GoalDateValue() {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (!targetDate) {
    return goal.kind === "exam" ? t("To be confirmed") : t("No end date");
  }

  return (
    <PlanDateText
      estimate={targetDateEstimated}
      isoDate={targetDate}
      month={targetDateNamedMonth}
    />
  );
}

export function PlanProperties({
  className,
  examHref = null,
  onOpen,
}: {
  className?: string;
  examHref?: string | null;
  onOpen: (section: PlanEditorSection) => void;
}) {
  const t = useExtracted();
  const activityName = useActivityName();
  const studyDaysText = useStudyDaysText();
  const varietyName = useVarietyName();
  const { goal, plan } = usePlanScreen();
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

        <PropertyRow label={t("Time a day")} onOpen={() => onOpen("time")}>
          <DailyTimeValue />
        </PropertyRow>

        <PropertyRow label={t("Study days")} onOpen={() => onOpen("days")}>
          {studyDaysText(plan.schedule.weekdayMinutes)}
        </PropertyRow>

        {plan.schedule.mocks && <MockExamsRow examHref={examHref} mocks={plan.schedule.mocks} />}

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
              ? t("Everything")
              : practiced.map((activity) => activityName(activity)).join(" · ")}
          </PropertyRow>
        )}
      </ul>
    </PageSection>
  );
}
