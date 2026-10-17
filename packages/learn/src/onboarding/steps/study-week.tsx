"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "../../_components/list-group";
import { WeekdayToggle } from "../../_components/weekday-toggle";
import { WeekendTime } from "../../_components/weekend-time";
import { type Choice, ChoiceList } from "../choice-list";

const DAYS_PER_WEEK = 7;

/** Every weekday, Sunday first, as the plan numbers them. */
export const EVERY_DAY = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day);

const MONDAY = 1;
const SATURDAY = 6;

/** Monday to Friday, the week a course's example plan reads too. */
const WEEKDAYS = EVERY_DAY.filter((day) => day >= MONDAY && day < SATURDAY);

/**
 * The days the time question opens on: the goal's own when someone already chose fewer than every
 * day, Monday to Friday otherwise. A new goal studies every day until this question asks, which
 * nobody chose, and a seven-day week is a lot to start with.
 */
export function getStartingDays(goalDays: number[]): number[] {
  return goalDays.length > 0 && goalDays.length < DAYS_PER_WEEK ? goalDays : WEEKDAYS;
}

export function WeekdayToggles({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  const t = useExtracted();

  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{t("Which days?")}</legend>
      <div className="flex justify-between gap-1.5">
        {EVERY_DAY.map((day) => (
          <WeekdayToggle
            className="size-11 rounded-lg font-mono text-[0.8125rem] font-medium uppercase"
            display="narrow"
            key={day}
            onPressedChange={(next) =>
              onChange(
                next
                  ? [...days, day].toSorted((a, b) => a - b)
                  : days.filter((item) => item !== day),
              )
            }
            pressed={days.includes(day)}
            variant="outline"
            weekday={day}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Saturday and Sunday's own time, in the same chips as the rest of the week. */
export function WeekendMinutes({
  choices,
  minutes,
  onChange,
  weekdayMinutes,
}: {
  choices: Choice<string>[];
  minutes: string | null;
  onChange: (minutes: string | null) => void;
  /** Where the weekend's own time starts when it's switched on. */
  weekdayMinutes: string;
}) {
  const t = useExtracted();

  return (
    <WeekendTime
      checked={minutes !== null}
      className="text-sm font-medium"
      onCheckedChange={(checked) => onChange(checked ? weekdayMinutes : null)}
    >
      {minutes !== null && (
        <ChoiceList
          choices={choices}
          label={t("Minutes on weekends")}
          numberKeys={false}
          onChange={onChange}
          value={minutes}
          variant="chips"
        />
      )}
    </WeekendTime>
  );
}

/** The time picked, large in the mono face, so the choice reads at a glance. */

/**
 * Which days, and the weekend's own time, folded into one row that says the week as it stands
 * ("6 days · 3h a week"), so the screen leads with its one decision: the time a day.
 */
export function WeekDisclosure({
  children,
  summary,
}: {
  children: React.ReactNode;
  summary: string;
}) {
  const t = useExtracted();

  return (
    <Collapsible className="border-border border-y">
      <CollapsibleTrigger className={cn(LIST_ROW_INTERACTIVE_CLASS, "group/week")}>
        <ListRowContent>
          <ListRowTitle>{t("Which days?")}</ListRowTitle>
        </ListRowContent>
        <ListRowTrailing aria-live="polite">{summary}</ListRowTrailing>
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-data-panel-open/week:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="flex flex-col gap-4 pt-1 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
