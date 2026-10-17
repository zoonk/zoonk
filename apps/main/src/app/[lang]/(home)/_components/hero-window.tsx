import { DayList, DaySegments } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { PlanRoad } from "@/components/public/plan-road";
import { ProductWindow } from "@/components/public/product-window";
import { Variant, VariantSwitch, VariantSwitchOption } from "@/components/public/variant-switch";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { GoalMark } from "@zoonk/learn/goal-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter } from "next-intl/server";
import { getExamplePlans } from "./example-plans";
import { getCurrentPhase, getRoadBands } from "./example-road";
import { getHeroDays } from "./hero-days";
import {
  DEFAULT_EXAMPLE_GOAL,
  EXAMPLE_GOALS,
  type ExampleGoal,
  GOAL_SWITCH,
  daysBetween,
  getExampleCalendar,
} from "./landing-examples";

const GOALS_LABEL_ID = "example-goals-label";

/**
 * The example goals as the app's goal switcher lists them (the mark, the name, the time a day and
 * the days left), a radio each: picking one shows its plan here and the rest of the page follows
 * it. Three across over the plan on a phone, a column beside it from 900px.
 */
async function ExampleGoalList() {
  const t = await getExtracted();
  const tSwitcher = await getExtracted("goalSwitcher");
  const minutesText = await getMinutesFormatter();
  const plans = await getExamplePlans();
  const { today } = await getExampleCalendar();

  return (
    <VariantSwitch
      aria-labelledby={GOALS_LABEL_ID}
      className="border-b p-3 min-[900px]:border-r min-[900px]:border-b-0 min-[900px]:p-3.5 min-[900px]:pt-5"
      defaultValue={DEFAULT_EXAMPLE_GOAL}
      name={GOAL_SWITCH}
      values={EXAMPLE_GOALS}
    >
      <p className="text-label px-2 pb-2.5" id={GOALS_LABEL_ID}>
        {t("Example goals")}
      </p>

      <div className="grid grid-cols-3 gap-0.5 min-[900px]:grid-cols-1">
        {EXAMPLE_GOALS.map((goal) => {
          const plan = plans[goal];
          const days = daysBetween({ from: today, to: plan.date });

          return (
            <VariantSwitchOption
              className={cn(
                "flex min-h-11 flex-col items-start gap-1.5 rounded-[0.625rem] p-2 transition-colors motion-reduce:transition-none min-[900px]:min-h-13 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-2.5",
                "hover:bg-muted/70 has-checked:bg-muted has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
              )}
              defaultValue={DEFAULT_EXAMPLE_GOAL}
              key={goal}
              name={GOAL_SWITCH}
              value={goal}
            >
              <span aria-hidden="true" className="flex">
                <GoalMark goal={plan.mark} />
              </span>

              <span className="flex min-w-0 flex-col">
                <span className="text-[0.8125rem] leading-snug font-[550] text-pretty min-[900px]:text-[0.84375rem]">
                  {plan.name}
                </span>
                <span className="text-muted-foreground font-mono text-[0.71875rem] tabular-nums max-[899px]:sr-only">
                  {[
                    tSwitcher("{time} a day", { time: minutesText(plan.dailyMinutes) }),
                    tSwitcher(
                      "{days, plural, =0 {The day is here} one {# day left} other {# days left}}",
                      { days },
                    ),
                  ]
                    .map((part) => part.replaceAll(" ", "\u00A0"))
                    .join(" · ")}
                </span>
              </span>
            </VariantSwitchOption>
          );
        })}
      </div>
    </VariantSwitch>
  );
}

/**
 * One example goal's plan on the examples' today: where it stands (its goal, the days left and
 * its pace or level), its road, and Today's queue under it.
 */
async function ExamplePlan({ goal }: { goal: ExampleGoal }) {
  const t = await getExtracted();
  const tSwitcher = await getExtracted("goalSwitcher");
  const format = await getFormatter();
  const minutesText = await getMinutesFormatter();
  const plans = await getExamplePlans();
  const days = await getHeroDays();
  const { today } = await getExampleCalendar();

  const plan = plans[goal];
  const steps = days[goal];
  const current = getCurrentPhase({ phases: plan.phases, today });
  const doneCount = steps.filter((step) => step.state === "done").length;
  const totalMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);

  const formatDay = (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" });

  const formatMonth = (date: Date) => format.dateTime(date, { month: "short", timeZone: "UTC" });

  const standing =
    goal === "move" ? t("Level {level} → {target}", { level: "A2", target: "B1" }) : t("On pace");

  return (
    <div className="flex min-w-0 flex-col gap-5 p-5 min-[900px]:px-8 min-[900px]:pt-7 sm:p-7">
      <p className="text-faint font-mono text-xs leading-4 uppercase">
        {[
          plan.shortName,
          tSwitcher("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", {
            days: daysBetween({ from: today, to: plan.date }),
          }),
          standing,
        ].join(" · ")}
      </p>

      <PlanRoad
        bands={getRoadBands({
          formatStart: goal === "exam" ? formatDay : formatMonth,
          phases: plan.phases,
          today,
        })}
        caption={t("Phase {number, number} of {total, number} · {name}", current)}
        end={formatDay(plan.date)}
        fullFrom="xl"
        todayLabel={t("Today")}
      />

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-label">{t("Today")}</p>
          <p className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
            {t("{done, number} of {total, number}", { done: doneCount, total: steps.length })}
            {" · "}
            {minutesText(totalMinutes)}
          </p>
        </div>

        <DaySegments steps={steps} />
        <DayList minutesText={minutesText} steps={steps} />
      </div>
    </div>
  );
}

/**
 * The product in the first screen: the example goals beside the plan of the one picked, in the
 * app's own window. Every plan is in the page; the picked one shows (`Variant`), and they share
 * one place, so the window keeps the height of the tallest and nothing under it moves. A caption
 * says they're examples and that the page follows the pick.
 */
export async function HeroWindow({ className }: { className?: string }) {
  const t = await getExtracted();

  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <ProductWindow className="grid grid-cols-1 min-[900px]:grid-cols-[17.75rem_minmax(0,1fr)]">
        <ExampleGoalList />

        <div className="grid min-w-0">
          {EXAMPLE_GOALS.map((goal) => (
            <Variant
              className="col-start-1 row-start-1 min-w-0"
              key={goal}
              name={GOAL_SWITCH}
              stacked
              value={goal}
            >
              <ExamplePlan goal={goal} />
            </Variant>
          ))}
        </div>
      </ProductWindow>

      <p className="text-muted-foreground text-[13px] text-pretty">
        {t(
          "Example plans. Yours follows your goal, your time and what you already know. Pick one: the rest of the page follows it.",
        )}
      </p>
    </div>
  );
}
