"use client";

import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { type DayStepPart, getDayMeterParts } from "../session/day-meter-parts";
import { getSessionQueue } from "../session/session-queue-rows";
import { type DayStep } from "../session/session-types";
import { useBlockTitle } from "../session/use-block-copy";
import { DayMeter } from "./day-segments";
import { useTodayScreen } from "./today-context";
import { getDayTime, getHeldMinutes } from "./today-time";

function getBlockShare(block: DayStep): number {
  if (block.status !== "active" || block.questions === 0) {
    return 0;
  }

  return Math.min(1, block.answered / block.questions);
}

function usePartFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return ({ block, state }: DayStepPart): string => {
    const time = formatDuration(block.estimatedMinutes);

    if (state === "done") {
      return t("Done");
    }

    if (state === "ahead") {
      return time;
    }

    return block.status === "active" && block.answered > 0
      ? t("{answered, number} of {count, plural, one {# question} other {# questions}}", {
          answered: block.answered,
          count: block.questions,
        })
      : [t("Up next"), time].join(" · ");
  };
}

/**
 * A picture of the day, not a row of buttons: a part per block is too thin to tap on a phone, and
 * the list under it opens each block. Its name reads the day in order, each block with its state.
 */
export function DayProgress({ className }: { className?: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const blockTitle = useBlockTitle();
  const partFacts = usePartFacts();
  const { today } = useTodayScreen();
  const { blocks, nextPosition, sessionBar } = today.session;
  const next = blocks.find((block) => block.position === nextPosition);
  const held = getHeldMinutes(today.session);

  const parts = getDayMeterParts({
    nextShare: next ? getBlockShare(next) : 0,
    rows: getSessionQueue({ blocks, nextPosition }),
  });

  const done = t(
    "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
    { done: sessionBar.completed, total: sessionBar.total },
  );

  const steps = parts.map((part) => `${blockTitle(part.block)}: ${partFacts(part)}`);
  const heldStep = held > 0 ? [`${t("Your next lessons")}: ${formatDuration(held)}`] : [];

  return (
    <DayMeter
      className={className}
      held={held > 0}
      label={[done, ...steps, ...heldStep].join(". ")}
      parts={parts}
    />
  );
}

/** The minutes actually studied, never the plan's minutes for the blocks done. */
function useStudiedToday(): number {
  const { today } = useTodayScreen();
  return today.session.week.days.find((day) => day.isToday)?.minutes ?? 0;
}

function DayTimeReadout({ className }: { className?: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { today } = useTodayScreen();
  const time = getDayTime({ day: today.session, studied: useStudiedToday() });

  if (!time) {
    return null;
  }

  return (
    <BigQuantity className={className}>
      {time.kind === "studied"
        ? t("{time} studied", { time: formatDuration(time.minutes) })
        : t("{time} left", { time: formatDuration(time.minutes) })}
    </BigQuantity>
  );
}

/**
 * A day that keeps time for a mock exam is shorter than the learner's time a day, so its time opens
 * why.
 */
export function DayTime({ className }: { className?: string }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { today } = useTodayScreen();
  const { mockFunding, session } = today;

  if (!mockFunding || session.state === "done" || session.state === "rest") {
    return <DayTimeReadout className={className} />;
  }

  return (
    <Popover>
      <PopoverTrigger
        className="decoration-faint hit-area focus-visible:ring-ring/50 relative rounded-sm underline decoration-dotted decoration-1 underline-offset-4 outline-none focus-visible:ring-[3px]"
        data-slot="today-shorter-day"
      >
        <DayTimeReadout className={className} />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 gap-2">
        <PopoverHeader>
          <PopoverTitle>{t("A shorter day")}</PopoverTitle>
          <PopoverDescription>
            {t("Your plan keeps time for the mock exam on {date}.", {
              date: formatDate(mockFunding.mockDate),
            })}
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}
