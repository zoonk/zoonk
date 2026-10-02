"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { usePlanStatusText } from "../plan/plan-status-label";
import { TodayBuddy, useBuddyTodayLine } from "./today-buddy";
import { useTodayScreen } from "./today-context";

const DESTINATION_TITLE_ID = "today-destination-title";
const THREE_DIGITS = 100;

function PacePill() {
  const statusText = usePlanStatusText();
  const { today } = useTodayScreen();
  const status = today.progress?.status;

  if (!status) {
    return null;
  }

  return (
    <p className="fun-glass inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold">
      <span aria-hidden="true" className="bg-fun-accent-lime size-2 rounded-full" />
      {statusText(status)}
    </p>
  );
}

function Countdown() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { daysLeft, title } = today.goal;

  if (daysLeft === null) {
    return (
      <h1
        className="font-fun-display text-2xl leading-tight font-bold text-balance wrap-break-word sm:text-4xl"
        id={DESTINATION_TITLE_ID}
      >
        {title}
      </h1>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-fun-fg2 text-sm">{t("Time left")}</p>
      <h1
        className={cn(
          "font-fun-display text-5xl leading-none font-extrabold tabular-nums sm:text-6xl",
          // Three digits ("160 days") would run into the planet on phones.
          daysLeft >= THREE_DIGITS && "max-sm:text-[2.5rem]",
        )}
        id={DESTINATION_TITLE_ID}
      >
        {t("{days, plural, =0 {Today} one {# day} other {# days}}", { days: daysLeft })}
      </h1>
    </div>
  );
}

/**
 * The goal as a ringed planet in the top right corner. On phones it leans past the edge like a
 * horizon; from tablets up it sits whole, ring and glow included.
 */
function Planet() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-2 -right-3 size-24 sm:top-0 sm:right-8 sm:size-36 lg:size-40"
    >
      <span className="fun-planet absolute inset-0" />
      <span className="border-fun-accent-amber/60 absolute inset-x-[-22%] top-[46%] h-[28%] -rotate-12 rounded-[50%] border-2" />
    </span>
  );
}

/** The dashed route toward the planet; purely decorative. */
function RouteLine() {
  return (
    <svg
      aria-hidden="true"
      className="text-fun-dash pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full"
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 400 100"
    >
      <path
        d="M0 95 C 120 80, 240 60, 400 0"
        stroke="currentColor"
        strokeDasharray="6 8"
        strokeLinecap="round"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BuddyOnRoute({ buddy }: { buddy: LearnBuddy }) {
  const line = useBuddyTodayLine(buddy);

  return (
    <div className="flex items-end gap-2">
      <TodayBuddy className="size-20 sm:size-24" buddy={buddy} />
      <p className="fun-glass mb-6 max-w-48 rounded-2xl rounded-bl-sm px-3 py-2 text-sm">{line}</p>
    </div>
  );
}

/**
 * The destination: the goal as a planet on the horizon, the countdown as the distance, and the
 * pace against the plan. The buddy rides along the route.
 */
export function FunDestination() {
  const t = useExtracted();
  const { buddy, today } = useTodayScreen();

  return (
    <section
      aria-labelledby={DESTINATION_TITLE_ID}
      className="relative -mx-4 flex flex-col gap-4 overflow-x-clip px-4 pb-4"
      data-slot="fun-destination"
    >
      <Planet />

      {/* The text keeps clear of the planet and its ring, which sit in the top right corner. */}
      <div className="relative flex flex-col gap-4 pr-24 sm:pr-52 lg:pr-56">
        {/* Without a date the goal itself is the heading, so the label doesn't repeat it. */}
        <p className="text-fun-fg2 text-xs font-semibold tracking-[0.2em] uppercase">
          {today.goal.daysLeft === null
            ? t("Destination")
            : t("Destination · {goal}", { goal: today.goal.title })}
        </p>

        <div className="flex flex-col gap-3">
          <Countdown />
          <PacePill />
        </div>
      </div>

      {buddy && (
        <div className="relative min-h-24">
          <RouteLine />
          <div className="relative flex justify-center">
            <BuddyOnRoute buddy={buddy} />
          </div>
        </div>
      )}
    </section>
  );
}
