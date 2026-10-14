"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { createContext, use } from "react";
import { type WaitState, useSlowWait } from "../_utils/use-slow-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useGoalSwitchPending } from "../shell/goal-switcher";
import { useTodayScreen } from "./today-context";
import { TodayExtraTime } from "./today-extra-time";
import { NEXT_TITLE_ID } from "./today-ids";
import { useContinueSession } from "./use-continue-session";
import { useDayState, useSessionState, useTodayPastDate } from "./use-today-copy";

/**
 * The day's one main action, 44px: full width under the queue on a phone, in the title row from
 * `sm`, as wide as its words.
 */
const ACTION_CLASS = "w-full text-[0.9375rem] sm:w-auto";

type TodayContinue = ReturnType<typeof useContinueSession> & { wait: WaitState };

const TodayContinueContext = createContext<TodayContinue | null>(null);

/**
 * Starts or continues the day once for the two places that show it: the button (and Enter, while
 * the day has a block to go on with) and the line that says how it's going (`TodayContinueStatus`).
 */
export function TodayContinueProvider({ children }: { children: React.ReactNode }) {
  const underway = useDayState() === "underway";
  const session = useContinueSession({ enterKey: underway });
  const wait = useSlowWait(session.isPending);

  return <TodayContinueContext value={{ ...session, wait }}>{children}</TodayContinueContext>;
}

function useTodayContinue(): TodayContinue {
  const value = use(TodayContinueContext);

  if (!value) {
    throw new Error("Today's action must be used within TodayContinueProvider");
  }

  return value;
}

/** Whether a slow or failed Start or Continue has something to say (`TodayContinueStatus`). */
export function useTodayContinueSpeaking(): boolean {
  const { failed, wait } = useTodayContinue();
  return failed || wait !== "none";
}

/**
 * What a slow or failed Start or Continue is doing, so the button never just greys out. It never
 * takes room of its own above anything: on a phone it's under the button, at the end of the day;
 * from `sm` it takes the place of the day's line under its segments (`DayMeta`), right under the
 * button. It's marked `data-speaking` while it says something. The status stays in the page while
 * empty, so screen readers hear it when it speaks.
 */
export function TodayContinueStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const { failed, wait } = useTodayContinue();
  const speaking = useTodayContinueSpeaking();

  return (
    <span className={className} data-speaking={speaking || undefined}>
      <span className="text-muted-foreground" role="status">
        {wait === "slow" && t("Opening your next step…")}
        {wait === "verySlow" &&
          t("This is taking longer than usual. It opens on its own, no need to tap again.")}
      </span>

      {failed && (
        <span className="text-destructive-text" role="alert">
          {t("We couldn't open the next step. Try again.")}
        </span>
      )}
    </span>
  );
}

/** Starts or continues the day from its button or Enter: it opens the next block. */
function ContinueButton() {
  const t = useExtracted();
  const { started } = useSessionState();
  const { isPending, run, wait } = useTodayContinue();

  return (
    <>
      <Button
        aria-describedby={NEXT_TITLE_ID}
        aria-keyshortcuts="Enter"
        className={ACTION_CLASS}
        disabled={isPending}
        focusableWhenDisabled
        onClick={run}
        size="lg"
      >
        {wait !== "none" && <Spinner aria-hidden="true" />}
        {started ? t("Continue session") : t("Start session")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </Button>

      <TodayContinueStatus className="text-sm data-speaking:pt-2 sm:hidden" />
    </>
  );
}

/** What changed today, the day's one next step once it's done: Enter opens it. */
function SummaryLink() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const switching = useGoalSwitchPending();
  const ref = useEnterClick<HTMLAnchorElement>({ enabled: !switching });

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg" }), ACTION_CLASS)}
      href={actions.summaryHref}
      prefetch={false}
      ref={ref}
    >
      {t("See what changed")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

/** A study day with nothing new: practice is the day's action while there's something to practice. */
function PracticeTime() {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const { extraTime } = today.session;

  if (!extraTime.available) {
    return null;
  }

  return (
    <TodayExtraTime
      action={actions.addExtraTime}
      className={ACTION_CLASS}
      label={t("Practice for {minutes} minutes", { minutes: String(extraTime.minutes) })}
      minutes={extraTime.minutes}
      size="lg"
      variant="default"
    />
  );
}

/**
 * The goal's date came with lessons left: the Plan, whose slot keeps the plan going in one tap
 * (Enter too).
 */
function SeePlanLink() {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const switching = useGoalSwitchPending();
  const ref = useEnterClick<HTMLAnchorElement>({ enabled: !switching });

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg" }), ACTION_CLASS)}
      href={routes.journey}
      ref={ref}
    >
      {t("See your plan")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

/**
 * The day's main action, one place for every state: Start or Continue while there's a block to go
 * on with (Enter too), "See what changed" once it's done, practice on a day with nothing new, the
 * Plan once the goal's date came with lessons left. A rest day, a day at its limit or one still
 * waiting for its lessons has none.
 */
export function TodayAction({ className }: { className?: string }) {
  const state = useDayState();
  const pastDate = useTodayPastDate();

  if (pastDate) {
    return (
      <div className={cn("flex flex-col sm:items-end", className)} data-slot="today-action">
        <SeePlanLink />
      </div>
    );
  }

  if (state !== "underway" && state !== "done" && state !== "ahead") {
    return null;
  }

  return (
    <div
      className={cn("flex flex-col empty:hidden sm:items-end", className)}
      data-slot="today-action"
    >
      {state === "underway" && <ContinueButton />}
      {state === "done" && <SummaryLink />}
      {state === "ahead" && <PracticeTime />}
    </div>
  );
}
