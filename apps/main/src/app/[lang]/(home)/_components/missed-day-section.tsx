import { DayList, type DayListStep } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import {
  SEGMENTED_OPTION_CLASS,
  SEGMENTED_TRACK_CLASS,
  Variant,
  VariantSwitch,
  VariantSwitchOption,
} from "@/components/public/variant-switch";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, CircleCheckIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { addDays, getExampleCalendar, getExampleSet } from "./landing-examples";
import { CAPTION_CLASS, DAY_SWITCH } from "./missed-day";
import { Spreadsheet } from "./missed-day-sheet";
import { Objection, ObjectionAnswer, ObjectionQuote, bold } from "./objection";

const TITLE_ID = "missed-day-title";
const YESTERDAY_LABEL_ID = "missed-day-yesterday";

const DAY_STATES = ["studied", "missed"] as const;
const DEFAULT_DAY = "studied";

const DAILY_MINUTES = 30;
const LESSON_MINUTES = 9;
const MISTAKES_MINUTES = 6;
const MORE_LESSONS = 2;

/** Days from today to the end of the phase while on pace; a missed day moves it one later. */
const PHASE_END_DAYS = 3;

async function ZoonkDay({ className }: { className?: string }) {
  const t = await getExtracted();
  const tPhases = await getExtracted("planPhases");
  const format = await getFormatter();
  const minutesText = await getMinutesFormatter();
  const { exam } = await getExampleSet();
  const { today } = await getExampleCalendar();
  const [oldest, yesterday, current] = exam.missedDay.topics;

  const formatDay = (date: Date) =>
    format
      .dateTime(date, { day: "numeric", month: "long", timeZone: "UTC" })
      .replaceAll(" ", "\u00A0");

  const phase = tPhases("Foundations");
  const onPaceEnd = formatDay(addDays(today, PHASE_END_DAYS));
  const movedEnd = formatDay(addDays(today, PHASE_END_DAYS + 1));

  const todayLesson: DayListStep = {
    detail: current.subject,
    id: "today",
    kind: "lesson",
    minutes: LESSON_MINUTES,
    state: "ahead",
    title: current.title,
  };

  const days: Record<(typeof DAY_STATES)[number], DayListStep[]> = {
    missed: [
      {
        detail: [t("From yesterday"), yesterday.subject].join(" · "),
        id: "yesterday",
        kind: "lesson",
        minutes: LESSON_MINUTES,
        state: "current",
        title: yesterday.title,
      },
      todayLesson,
    ],
    studied: [
      { ...todayLesson, state: "current" },
      {
        detail: [
          t("Mistakes notebook"),
          t("{count, plural, one {# question} other {# questions}}", { count: 3 }),
        ].join(" · "),
        id: "mistakes",
        kind: "mistakes",
        minutes: MISTAKES_MINUTES,
        state: "ahead",
        title: oldest.title,
      },
    ],
  };

  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className={CAPTION_CLASS}>{t("In Zoonk")}</figcaption>

      <ProductWindow className="shadow-[0_1px_2px_oklch(0_0_0/5%),0_18px_44px_-18px_oklch(0_0_0/20%)] dark:shadow-[0_1px_2px_oklch(0_0_0/50%),0_24px_56px_-20px_oklch(0_0_0/75%)]">
        <p className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-1">
          <span className="text-[1.1875rem] font-semibold tracking-[-0.02em]">{t("Today")}</span>
          <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-sm")}>
            {minutesText(DAILY_MINUTES)}
          </span>
        </p>

        <div className="grid *:col-start-1 *:row-start-1">
          {DAY_STATES.map((state) => (
            <Variant key={state} name={DAY_SWITCH} stacked value={state}>
              <DayList
                className="px-5 **:data-[slot=list-row-title]:text-[0.9375rem]"
                minutesText={minutesText}
                steps={days[state]}
              />
            </Variant>
          ))}
        </div>

        <p className="text-muted-foreground px-5 pt-1 pb-2 pl-12 text-[0.84375rem]">
          {t("{count, plural, one {And # more lesson} other {And # more lessons}}", {
            count: MORE_LESSONS,
          })}
        </p>

        <div className="bg-muted mx-3 mb-3 grid rounded-xl p-3.5 text-[0.9375rem] leading-[1.45] *:col-start-1 *:row-start-1 [&_b]:font-semibold">
          <Variant
            className="flex items-start gap-3 self-center"
            name={DAY_SWITCH}
            stacked
            value="studied"
          >
            <CircleCheckIcon aria-hidden="true" className="text-success mt-0.5 size-4.5 shrink-0" />
            <p>
              {t.rich({
                description:
                  "{phase} is a plan phase's name, such as “Foundations”; quote it if your language needs that to read naturally.",
                message: "<b>On pace.</b> You finish the {phase} phase on {date}.",
                values: { b: bold, date: onPaceEnd, phase },
              })}
            </p>
          </Variant>

          <Variant
            className="flex items-start gap-3 self-center"
            name={DAY_SWITCH}
            stacked
            value="missed"
          >
            <CalendarClockIcon
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-4.5 shrink-0"
            />
            <p>
              {t.rich({
                description:
                  "{phase} is a plan phase's name, such as “Foundations”; quote it if your language needs that to read naturally.",
                message: "<b>Your plan changed:</b> you finish the {phase} phase on {date}.",
                values: { b: bold, date: movedEnd, phase },
              })}
              <span className="text-muted-foreground block text-[0.84375rem]">
                {t("Before, it was {date}.", { date: onPaceEnd })}
              </span>
            </p>
          </Variant>
        </div>
      </ProductWindow>
    </figure>
  );
}

export async function MissedDaySection() {
  const t = await getExtracted();
  // The switch's answers have their own namespace: the app's "Studied" is a day's state, not an answer.
  const tYesterday = await getExtracted("yesterdaySwitch");
  const minutesText = await getMinutesFormatter();
  const { exam } = await getExampleSet();

  return (
    <Objection titleId={TITLE_ID}>
      <div className="flex flex-col items-center text-center" data-centered>
        <ObjectionQuote id={TITLE_ID}>
          {t({
            description:
              "A learner's own worry, in their casual words, shown as a big quote. In Brazilian Portuguese: “Perdi um dia e desandou tudo.”",
            message: "I missed a day and it all fell apart.",
          })}
        </ObjectionQuote>
        <ObjectionAnswer>
          {t.rich(
            "<b>It happens.</b> What's left from yesterday comes first today. If a date changes, your plan tells you.",
            { b: bold },
          )}
        </ObjectionAnswer>
      </div>

      <VariantSwitch
        aria-labelledby={YESTERDAY_LABEL_ID}
        className="mt-11 flex items-center justify-center gap-3"
        defaultValue={DEFAULT_DAY}
        name={DAY_SWITCH}
        values={DAY_STATES}
      >
        <span className="text-[0.9375rem] font-medium" id={YESTERDAY_LABEL_ID}>
          {t("Yesterday")}
        </span>

        <span className={SEGMENTED_TRACK_CLASS}>
          <VariantSwitchOption
            className={cn(SEGMENTED_OPTION_CLASS, "h-10 px-3.5 text-sm")}
            defaultValue={DEFAULT_DAY}
            name={DAY_SWITCH}
            value="studied"
          >
            {tYesterday("Studied")}
          </VariantSwitchOption>

          <VariantSwitchOption
            className={cn(SEGMENTED_OPTION_CLASS, "h-10 px-3.5 text-sm")}
            defaultValue={DEFAULT_DAY}
            name={DAY_SWITCH}
            value="missed"
          >
            {tYesterday("No time")}
          </VariantSwitchOption>
        </span>
      </VariantSwitch>

      <div className="mx-auto mt-7 grid max-w-250 grid-cols-1 gap-7 text-left min-[880px]:grid-cols-2 min-[880px]:gap-8">
        <Spreadsheet />
        <ZoonkDay className="max-[879px]:order-first" />
      </div>

      <p className="text-muted-foreground mt-3.5 text-center text-[0.84375rem]">
        {t("Example: {goal}, {time} a day.", {
          goal: exam.missedDay.goal,
          time: minutesText(DAILY_MINUTES),
        })}
      </p>
    </Objection>
  );
}
