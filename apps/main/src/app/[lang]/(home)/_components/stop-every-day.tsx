import {
  AnnotationCaption,
  AnnotationCaptions,
  AnnotationMark,
} from "@/components/public/annotation";
import { DayList, type DayListStep } from "@/components/public/day-list";
import { ProductWindow } from "@/components/public/product-window";
import {
  Stop,
  StopBody,
  StopEyebrow,
  StopHeader,
  StopLead,
  StopMark,
  StopTitle,
} from "@/components/public/stop";
import {
  SEGMENTED_OPTION_CLASS,
  SEGMENTED_TRACK_CLASS,
  Variant,
  VariantSwitch,
  VariantSwitchOption,
} from "@/components/public/variant-switch";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { DiffLines } from "@zoonk/learn/diff-lines";
import { KindDot } from "@zoonk/learn/kind-tile";
import { DoneMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { getExamplePlans } from "./example-plans";
import { GoalMeasure } from "./goal-measure";
import { getTomorrows } from "./goal-tomorrows";
import {
  EXAMPLE_GOALS,
  type ExampleGoal,
  GOAL_SWITCH,
  daysBetween,
  getExampleCalendar,
  getExampleSet,
} from "./landing-examples";
import { getMissedDayChange } from "./missed-day";
import {
  DAY_STATES,
  DAY_SWITCH,
  DEFAULT_DAY,
  type DayState,
  type TomorrowStep,
} from "./tomorrow-steps";

const STOP_TITLE_ID = "stop-every-day";
const YESTERDAY_LABEL_ID = "stop-every-day-yesterday";

/** A day's rows with their numbers on them, pointing to the captions under the window. */
function withNotes(steps: readonly TomorrowStep[]): DayListStep[] {
  return steps.map(({ note, ...step }) => ({
    ...step,
    annotation: note === undefined ? undefined : <AnnotationMark>{note}</AnnotationMark>,
  }));
}

/**
 * What changed in the plan when yesterday was missed: its phase ends a day later, or, with the
 * date too near for that, one of its lessons is left out; the date stays.
 */
async function PlanChanged({ goal }: { goal: ExampleGoal }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const set = await getExampleSet();
  const plans = await getExamplePlans();
  const { tomorrow } = await getExampleCalendar();
  const plan = plans[goal];

  const current = plan.phases.find((phase) => phase.start <= tomorrow && phase.end >= tomorrow);

  const formatDay = (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" });

  const end = current?.end ?? plan.date;
  const change = getMissedDayChange({ date: plan.date, end });
  const phaseName = current?.name ?? "";

  const goalDate = {
    exam: t("{exam} on {date}", {
      date: formatDay(plan.date),
      exam: set.exam === "enem" ? t("ENEM") : t("SAT"),
    }),
    job: t("Goal date {date}", { date: formatDay(plan.date) }),
    move: t("Moving day {date}", { date: formatDay(plan.date) }),
  }[goal];

  return (
    <div className="mt-4 flex flex-col gap-2.5 border-t pt-4">
      <p className="flex items-center gap-2 text-[0.84375rem] font-semibold">
        <CalendarClockIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        {t("Your plan changed")}
      </p>

      <DiffLines
        labels={{ added: t("New"), removed: t("Was") }}
        lines={
          change.kind === "moved"
            ? [
                // A phase's end that moves is a plain move; only the lesson a missed day takes out
                // is bad news, so it alone is red (as every plan diff colors by meaning).
                {
                  kind: "removed",
                  text: t("{phase} until {date}", { date: formatDay(end), phase: phaseName }),
                  tone: "neutral",
                },
                {
                  kind: "added",
                  text: t("{phase} until {date}", {
                    date: formatDay(change.movedEnd),
                    phase: phaseName,
                  }),
                  tone: "neutral",
                },
                { kind: "context", text: goalDate },
              ]
            : [
                {
                  kind: "removed",
                  text: t("One lesson of {phase}", { phase: phaseName }),
                  tone: "bad",
                },
                { kind: "context", text: goalDate },
              ]
        }
      />
    </div>
  );
}

/**
 * Tomorrow's Today for one example goal: its date and days left, the title, its queue after a
 * studied yesterday (and "On pace. Nothing moves.") or a missed one (yesterday's lesson first, and
 * the plan's change), and the goal's measure beside it from 1100px.
 */
async function TomorrowWindow({ goal }: { goal: ExampleGoal }) {
  const t = await getExtracted();
  const tSwitcher = await getExtracted("goalSwitcher");
  const format = await getFormatter();
  const minutesText = await getMinutesFormatter();
  const plans = await getExamplePlans();
  const tomorrows = await getTomorrows();
  const { tomorrow } = await getExampleCalendar();
  const plan = plans[goal];

  const date = format.dateTime(tomorrow, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  });

  return (
    <ProductWindow className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4 p-5 sm:px-9 sm:pt-8 sm:pb-7">
        <div className="flex flex-col gap-1">
          <p className="text-faint font-mono text-xs leading-4 uppercase">
            {[
              date,
              tSwitcher(
                "{days, plural, =0 {The day is here} one {# day left} other {# days left}}",
                { days: daysBetween({ from: tomorrow, to: plan.date }) },
              ),
            ].join(" · ")}
          </p>
          {/* Tomorrow morning's Today, the day after the hero's. */}
          <p className="text-title">{t("Tomorrow")}</p>
        </div>

        <Variant name={DAY_SWITCH} value="studied">
          <DayList minutesText={minutesText} steps={withNotes(tomorrows[goal].studied)} />

          <p className="mt-4 flex items-center gap-2 border-t pt-4 text-[0.84375rem]">
            <DoneMark />
            {t("On pace. Nothing moves.")}
          </p>
        </Variant>

        <Variant name={DAY_SWITCH} value="missed">
          <DayList minutesText={minutesText} steps={withNotes(tomorrows[goal].missed)} />
          <PlanChanged goal={goal} />
        </Variant>
      </div>

      <div className="hidden flex-col gap-3 border-l px-6.5 py-8 min-[1100px]:flex">
        {DAY_STATES.map((day) => (
          <Variant className="flex flex-col gap-3" key={day} name={DAY_SWITCH} value={day}>
            <GoalMeasure day={day} goal={goal} />
          </Variant>
        ))}
      </div>
    </ProductWindow>
  );
}

/** What each number on tomorrow's rows points at, in the order of the day being shown. */
async function DayCaptions() {
  const t = await getExtracted();

  const writtenForGoal = {
    id: "written",
    text: t("Short lessons Zoonk writes for your goal."),
    title: t("Written for your goal"),
  };

  const backBeforeYouForget = {
    id: "back",
    text: t("What you studied comes back right before you'd forget it."),
    title: t("Back before you forget"),
  };

  const mistakesPracticed = {
    id: "mistakes",
    text: t("Every mistake comes back until you get it right."),
    title: t("Mistakes, practiced"),
  };

  const fromYesterday = {
    id: "yesterday",
    text: t("What you missed comes first, and the rest of your plan moves to fit."),
    title: t("From yesterday"),
  };

  const captions: Record<DayState, { id: string; text: string; title: string }[]> = {
    missed: [fromYesterday, backBeforeYouForget, writtenForGoal, mistakesPracticed],
    studied: [writtenForGoal, backBeforeYouForget, mistakesPracticed],
  };

  return DAY_STATES.map((state) => (
    <Variant key={state} name={DAY_SWITCH} value={state}>
      <AnnotationCaptions className={cn(state === "studied" && "lg:grid-cols-3")}>
        {captions[state].map((caption, index) => (
          <AnnotationCaption key={caption.id} number={index + 1} title={caption.title}>
            {caption.text}
          </AnnotationCaption>
        ))}
      </AnnotationCaptions>
    </Variant>
  ));
}

/**
 * Every day: tomorrow's Today for the example goal the visitor picked, with yesterday's switch,
 * so they can see what a missed day does: yesterday's lesson comes first and the plan moves to
 * fit, while a studied day changes nothing. Its rows are numbered, and the captions under the
 * window say what each is.
 */
export async function StopEveryDay() {
  const t = await getExtracted();
  // The switch's answers have their own namespace: the app's "Studied" is a day's state, not an answer.
  const tYesterday = await getExtracted("yesterdaySwitch");

  return (
    <Stop aria-labelledby={STOP_TITLE_ID} band rail>
      <StopHeader>
        <StopEyebrow>
          <StopMark>
            <KindDot className="size-2.5" kind="lesson" />
          </StopMark>
          {t("Every day")}
        </StopEyebrow>

        <StopTitle id={STOP_TITLE_ID}>{t("Your day is ready when you open Zoonk.")}</StopTitle>

        <StopLead>
          {t(
            "Short lessons written for your goal, reviews right before you'd forget, and your mistakes to practice. Missed yesterday? It comes first.",
          )}
        </StopLead>
      </StopHeader>

      <StopBody className="flex flex-col gap-4">
        <VariantSwitch
          aria-labelledby={YESTERDAY_LABEL_ID}
          className="flex items-center gap-3"
          defaultValue={DEFAULT_DAY}
          name={DAY_SWITCH}
          values={DAY_STATES}
        >
          <span className="text-muted-foreground text-sm font-medium" id={YESTERDAY_LABEL_ID}>
            {t("Yesterday")}
          </span>

          <span className={SEGMENTED_TRACK_CLASS}>
            <VariantSwitchOption
              className={SEGMENTED_OPTION_CLASS}
              defaultValue={DEFAULT_DAY}
              name={DAY_SWITCH}
              value="studied"
            >
              {tYesterday("Studied")}
            </VariantSwitchOption>

            <VariantSwitchOption
              className={SEGMENTED_OPTION_CLASS}
              defaultValue={DEFAULT_DAY}
              name={DAY_SWITCH}
              value="missed"
            >
              {tYesterday("No time")}
            </VariantSwitchOption>
          </span>
        </VariantSwitch>

        {EXAMPLE_GOALS.map((goal) => (
          <Variant key={goal} name={GOAL_SWITCH} value={goal}>
            <TomorrowWindow goal={goal} />
          </Variant>
        ))}

        <div className="mt-3">
          <DayCaptions />
        </div>
      </StopBody>
    </Stop>
  );
}
