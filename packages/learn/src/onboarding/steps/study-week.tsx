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
import { OtherTimeSelect } from "./daily-minutes";

const DAYS_PER_WEEK = 7;

/** Sunday is 0, as the plan numbers weekdays. */
export const EVERY_DAY = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day);

const MONDAY = 1;
const SATURDAY = 6;

const WEEKDAYS = EVERY_DAY.filter((day) => day >= MONDAY && day < SATURDAY);

/**
 * A new goal's every-day week was never chosen, so the question opens on Monday to Friday unless
 * someone chose fewer days.
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

export function WeekendMinutes({
  choices,
  minutes,
  onChange,
  weekdayMinutes,
}: {
  choices: Choice<string>[];
  minutes: string | null;
  onChange: (minutes: string | null) => void;
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
        <div className="flex flex-col gap-2">
          <ChoiceList
            choices={choices}
            label={t("Minutes on weekends")}
            numberKeys={false}
            onChange={onChange}
            value={minutes}
            variant="chips"
          />
          <OtherTimeSelect
            label={t("Other time on weekends")}
            minutes={Number(minutes)}
            onPick={(next) => onChange(String(next))}
          />
        </div>
      )}
    </WeekendTime>
  );
}

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
