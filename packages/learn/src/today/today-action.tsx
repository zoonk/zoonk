"use client";

import { BusyContent, Button, FORWARD_ICON, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ListPlusIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use } from "react";
import { OpeningWaitLine } from "../_components/opening-wait-line";
import { ChangeSaveError } from "../_components/save-error";
import { usePendingSender } from "../_utils/use-pending-sender";
import { useSlowWait } from "../_utils/use-slow-wait";
import { type WaitState } from "../_utils/wait-state";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { useSessionAction } from "../session/use-session-action";
import { useGoalSwitchPending } from "../shell/goal-switcher";
import { useTodayScreen } from "./today-context";
import { NEXT_TITLE_ID } from "./today-ids";
import { TODAY_ACTION_STATUS_CLASS } from "./today-layout";
import { useContinueSession } from "./use-continue-session";
import { useDayState, useSessionState, useTodayPastDate, useUpNextLessons } from "./use-today-copy";

const ACTION_CLASS = "w-full text-[0.9375rem] sm:w-auto";

type SessionAction = ReturnType<typeof useSessionAction> & { wait: WaitState };

/** The up-next list's first row sends it too; only the control that sent it spins. */
type KeepLearningAction = SessionAction & { openFromRow: () => void; rowSent: boolean };

type TodayContinue = ReturnType<typeof useContinueSession> & {
  keep: KeepLearningAction;
  wait: WaitState;
};

const TodayContinueContext = createContext<TodayContinue | null>(null);

/**
 * One action for the button, Enter and the status line, and one for "Keep learning" and the up-next
 * list's first row, so a tap on either is one request.
 */
export function TodayContinueProvider({ children }: { children: React.ReactNode }) {
  const { actions } = useTodayScreen();
  const underway = useDayState() === "underway";
  const keepLearning = useUpNextLessons().length > 0;
  const session = useContinueSession({ enterKey: underway });
  const wait = useSlowWait(session.isPending);
  const keep = useSessionAction({ action: actions.addExtraTime, enterKey: keepLearning });
  const keepWait = useSlowWait(keep.isPending);
  const [keepSender, setKeepSender] = usePendingSender<"row">(keep.isPending);

  const openFromRow = () => {
    setKeepSender("row");
    keep.run();
  };

  const keepAction = { ...keep, openFromRow, rowSent: keepSender === "row", wait: keepWait };

  return (
    <TodayContinueContext value={{ ...session, keep: keepAction, wait }}>
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

export function useKeepLearning(): KeepLearningAction {
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
      lessonWritten={href.startsWith("/learn/")}
      ref={ref}
    >
      <BusyContent icon={<PlayIcon aria-hidden="true" />}>
        {started ? t("Continue session") : t("Start session")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </BusyContent>
    </LearnLink>
  );
}

function ContinueButton() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const { started } = useSessionState();
  const { isPending, run } = useTodayContinue();

  if (actions.continueHref) {
    return <ContinueLink href={actions.continueHref} />;
  }

  return (
    <>
      <Button
        aria-describedby={NEXT_TITLE_ID}
        aria-keyshortcuts="Enter"
        busy={isPending}
        className={ACTION_CLASS}
        icon={<PlayIcon aria-hidden="true" />}
        onClick={run}
        size="lg"
      >
        {started ? t("Continue session") : t("Start session")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </Button>

      <TodayContinueStatus className={cn(TODAY_ACTION_STATUS_CLASS, "sm:hidden")} />
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
      <BusyContent {...FORWARD_ICON}>
        {t("See today's summary")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </BusyContent>
    </LearnLink>
  );
}

function SaveAction({
  action,
  children,
  icon,
}: {
  action: () => Promise<boolean>;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <>
      <Button busy={isPending} className={ACTION_CLASS} icon={icon} onClick={run} size="lg">
        {children}
      </Button>

      <div className={TODAY_ACTION_STATUS_CLASS} data-speaking={failed || undefined}>
        {failed && <ChangeSaveError />}
      </div>
    </>
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
    <SaveAction action={actions.addExtraTime} icon={<PlayIcon aria-hidden="true" />}>
      {t("Practice for {minutes} minutes", { minutes: String(extraTime.minutes) })}
    </SaveAction>
  );
}

function PrepareLessons() {
  const t = useExtracted();
  const { actions } = useTodayScreen();

  return (
    <SaveAction action={actions.prepareLessons} icon={<ListPlusIcon aria-hidden="true" />}>
      {t({
        description: "Button that has Zoonk write today's lessons.",
        message: "Get today's lessons",
      })}
    </SaveAction>
  );
}

function KeepLearning() {
  const t = useExtracted();
  const { failed, isPending, rowSent, run, wait } = useKeepLearning();

  return (
    <>
      <Button
        aria-keyshortcuts="Enter"
        busy={isPending && !rowSent}
        className={ACTION_CLASS}
        disabled={rowSent}
        focusableWhenDisabled
        icon={<PlayIcon aria-hidden="true" />}
        onClick={run}
        size="lg"
      >
        {t("Keep learning")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </Button>

      <span
        className={TODAY_ACTION_STATUS_CLASS}
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
      <BusyContent {...FORWARD_ICON}>
        {t("See your plan")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </BusyContent>
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

  if (state === "prepare") {
    return (
      <div className={cn("flex flex-col sm:items-end", className)} data-slot="today-action">
        <PrepareLessons />
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
