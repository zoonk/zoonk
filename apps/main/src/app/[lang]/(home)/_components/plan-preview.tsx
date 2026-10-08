import {
  RouteCard,
  RouteCardDivider,
  RouteCardEyebrow,
  RouteCardFact,
  RouteCardFacts,
  RouteCardTitle,
  RouteStop,
  RouteStops,
} from "@/components/public/route-card";
import { CalendarIcon, CirclePlayIcon, ClockIcon, SkipForwardIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getExampleDates } from "./example-dates";
import { getExampleMove } from "./example-move";

function renderMuted(chunks: ReactNode) {
  return <span className="text-muted-foreground font-normal">{chunks}</span>;
}

/**
 * The goal typed in the hero, turned into a plan: a phase skipped after
 * placement, today's session in the current phase, and the dates ahead. All
 * plain HTML, so it's part of the page and costs no images.
 */
export async function PlanPreview({ className }: { className?: string }) {
  const [t, dates, move] = await Promise.all([getExtracted(), getExampleDates(), getExampleMove()]);

  return (
    <RouteCard className={className} label={t("An example plan")}>
      <RouteCardEyebrow>{t("Your plan")}</RouteCardEyebrow>
      <RouteCardTitle>
        {t(
          "{move, select, london {Speak English for my move to London} other {Speak Spanish for my move to Madrid}}",
          { move },
        )}
      </RouteCardTitle>

      <RouteCardFacts>
        <RouteCardFact icon={<CalendarIcon aria-hidden="true" />}>
          {t("Moving {date}", { date: dates.movingDay })}
        </RouteCardFact>
        <RouteCardFact icon={<ClockIcon aria-hidden="true" />}>{t("20 min a day")}</RouteCardFact>
        <RouteCardFact icon={<SkipForwardIcon aria-hidden="true" />}>
          {t("2 units skipped")}
        </RouteCardFact>
      </RouteCardFacts>

      <RouteCardDivider />

      <RouteStops>
        <RouteStop
          detail={t("Greetings, numbers, simple questions")}
          state="done"
          title={t("The basics")}
        >
          <span className="mt-2 inline-flex min-h-6 items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs leading-snug font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {t("Skipped after placement")}
          </span>
        </RouteStop>

        <RouteStop
          detail={t("Airport, metro, finding an apartment")}
          state="now"
          title={t.rich("Arriving <muted>· now</muted>", { muted: renderMuted })}
        >
          <span className="bg-foreground text-background mt-2 inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs leading-snug font-medium">
            <CirclePlayIcon aria-hidden="true" className="size-3.5 flex-none" />
            {t("Today · 20 min ready")}
          </span>
        </RouteStop>

        <RouteStop
          aside={dates.workPhase}
          detail={t("Meetings, email, small talk")}
          state="future"
          title={t("At work")}
        />

        <RouteStop
          aside={dates.dailyLife}
          detail={t("Bank, doctor, neighbors")}
          state="future"
          title={t("Daily life")}
        />

        <RouteStop
          aside={dates.movingDay}
          detail={t("Moving day")}
          state="goal"
          title={t("{move, select, london {London} other {Madrid}}", { move })}
        />
      </RouteStops>
    </RouteCard>
  );
}
