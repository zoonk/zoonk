"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { createContext, use } from "react";
import { OpeningWaitLine } from "../_components/opening-wait-line";
import { useSlowWait } from "../_utils/use-slow-wait";
import { type WaitState } from "../_utils/wait-state";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useSessionAction } from "../session/use-session-action";
import { useGoalSwitchPending } from "../shell/goal-switcher";
import { useTodayScreen } from "./today-context";
import { TodayExtraTime } from "./today-extra-time";
import { NEXT_TITLE_ID } from "./today-ids";
import { useContinueSession } from "./use-continue-session";
import { useDayState, useSessionState, useTodayPastDate, useUpNextLessons } from "./use-today-copy";

const ACTION_CLASS = "w-full text-[0.9375rem] sm:w-auto";

type SessionAction = ReturnType<typeof useSessionAction> & { wait: WaitState };

type TodayContinue = ReturnType<typeof useContinueSession> & {
  keep: SessionAction;
  wait: WaitState;
};

const TodayContinueContext = createContext<TodayContinue | null>(null);

/** One action for the button, Enter and the status line, and one for "Keep learning" and the up-next list's first row, so a tap on either is one request. */
export function TodayContinueProvider({ children }: { children: React.ReactNode }) {
  const { actions } = useTodayScreen();
  const underway = useDayState() === "underway";
  const keepLearning = useUpNextLessons().length > 0;
  const session = useContinueSession({ enterKey: underway });
  const wait = useSlowWait(session.isPending);
  const keep = useSessionAction({ action: actions.addExtraTime, enterKey: keepLearning });
  const keepWait = useSlowWait(keep.isPending);

  return (
    <TodayContinueContext value={{ ...session, keep: { ...keep, wait: keepWait }, wait }}>
      {children}
    </TodayContinueContext>
  );
}

function useTodayContinue(): TodayContinue {
  const value = use(TodayContinueContext);

  if (!value) {
    throw new Error("Today's action must be used within TodayContinueProvider");
  }

  return value;
}

export function useKeepLearning(): SessionAction {
  return useTodayContinue().keep;
}

export function useTodayContinueSpeaking(): boolean {
  const { failed, wait } = useTodayContinue();
  return failed || wait !== "none";
}

/** Marked `data-speaking` while it says something. */
export function TodayContinueStatus({ className }: { className?: string }) {
  const t = useExtracted();
  const { failed, wait } = useTodayContinue();
  const speaking = useTodayContinueSpeaking();

  return (
    <span className={className} data-speaking={speaking || undefined}>
      <OpeningWaitLine wait={wait} />

      {failed && (
        <span className="text-destructive-text" role="alert">
          {t("We couldn't open the next step. Try again.")}
        </span>
      )}
    </span>
  );
}

function ContinueLink({ href }: { href: string }) {
  const t = useExtracted();
  const { started } = useSessionState();
  const switching = useGoalSwitchPending();
  const ref = useEnterClick<HTMLAnchorElement>({ enabled: !switching });

  return (
    <LearnLink
      aria-describedby={NEXT_TITLE_ID}
      className={cn(buttonVariants({ size: "lg" }), ACTION_CLASS)}
      href={href}
      ref={ref}
    >
      {started ? t("Continue session") : t("Start session")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

function ContinueButton() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const { started } = useSessionState();
  const { isPending, run, wait } = useTodayContinue();

  if (actions.continueHref) {
    return <ContinueLink href={actions.continueHref} />;
  }

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
      {t("See today's summary")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

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

function KeepLearning() {
  const t = useExtracted();
  const { failed, isPending, run, wait } = useKeepLearning();

  return (
    <>
      <Button
        aria-keyshortcuts="Enter"
        className={ACTION_CLASS}
        disabled={isPending}
        focusableWhenDisabled
        onClick={run}
        size="lg"
      >
        {wait !== "none" && <Spinner aria-hidden="true" />}
        {t("Keep learning")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </Button>

      <span
        className="text-sm data-speaking:pt-2"
        data-speaking={failed || wait !== "none" || undefined}
      >
        <OpeningWaitLine wait={wait} />

        {failed && (
          <span className="text-destructive-text" role="alert">
            {t("We couldn't open your next lessons. Try again.")}
          </span>
        )}
      </span>
    </>
  );
}

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

export function TodayAction({ className }: { className?: string }) {
  const state = useDayState();
  const pastDate = useTodayPastDate();
  const keepLearning = useUpNextLessons().length > 0;

  if (pastDate) {
    return (
      <div className={cn("flex flex-col sm:items-end", className)} data-slot="today-action">
        <SeePlanLink />
      </div>
    );
  }

  if (keepLearning) {
    return (
      <div className={cn("flex flex-col sm:items-end", className)} data-slot="today-action">
        <KeepLearning />
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
