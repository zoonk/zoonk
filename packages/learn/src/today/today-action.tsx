"use client";

import { useExtracted } from "next-intl";
import { createContext, use } from "react";
import { EnterButton, EnterLink } from "../_components/enter-button";
import { OpeningWaitLine } from "../_components/opening-wait-line";
import { ChangeSaveError } from "../_components/save-error";
import { usePendingSender } from "../_utils/use-pending-sender";
import { useSlowWait } from "../_utils/use-slow-wait";
import { type WaitState } from "../_utils/wait-state";
import { useLearnRoutes } from "../learn-context";
import { useSessionAction } from "../session/use-session-action";
import { useGoalSwitchPending } from "../shell/goal-switcher";
import { TodayBar } from "./today-bar";
import { useTodayScreen } from "./today-context";
import { TodayExamOver } from "./today-exam-over";
import { NEXT_TITLE_ID } from "./today-ids";
import { useContinueSession } from "./use-continue-session";
import { useDayState, useSessionState, useTodayPastDate, useUpNextLessons } from "./use-today-copy";

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

function useTodayContinueSpeaking(): boolean {
  const { failed, wait } = useTodayContinue();
  return failed || wait !== "none";
}

function TodayContinueStatus() {
  const t = useExtracted();
  const { failed, wait } = useTodayContinue();

  return (
    <>
      <OpeningWaitLine wait={wait} />

      {failed && (
        <span className="text-destructive-text" role="alert">
          {t("We couldn't open the next step. Try again.")}
        </span>
      )}
    </>
  );
}

function ContinueLink({ href }: { href: string }) {
  const t = useExtracted();
  const { started } = useSessionState();
  const switching = useGoalSwitchPending();

  return (
    <TodayBar>
      <EnterLink
        aria-describedby={NEXT_TITLE_ID}
        enabled={!switching}
        href={href}
        lessonWritten={href.startsWith("/learn/")}
      >
        {started ? t("Continue") : t("Start")}
      </EnterLink>
    </TodayBar>
  );
}

function ContinueButton() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const { started } = useSessionState();
  const { isPending, run } = useTodayContinue();
  const speaking = useTodayContinueSpeaking();

  if (actions.continueHref) {
    return <ContinueLink href={actions.continueHref} />;
  }

  return (
    <TodayBar note={speaking && <TodayContinueStatus />}>
      <form action={() => void run()} className="contents">
        <EnterButton aria-describedby={NEXT_TITLE_ID} busy={isPending} enter="host" type="submit">
          {started ? t("Continue") : t("Start")}
        </EnterButton>
      </form>
    </TodayBar>
  );
}

function SummaryLink() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const switching = useGoalSwitchPending();

  return (
    <TodayBar>
      <EnterLink enabled={!switching} href={actions.summaryHref} prefetch={false}>
        {t("See today's summary")}
      </EnterLink>
    </TodayBar>
  );
}

function SaveAction({
  action,
  children,
}: {
  action: () => Promise<boolean>;
  children: React.ReactNode;
}) {
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <TodayBar note={failed && <ChangeSaveError />}>
      <form action={() => void run()} className="contents">
        <EnterButton busy={isPending} type="submit">
          {children}
        </EnterButton>
      </form>
    </TodayBar>
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
    <SaveAction action={actions.addExtraTime}>
      {t("Practice {minutes} min", { minutes: String(extraTime.minutes) })}
    </SaveAction>
  );
}

function PrepareLessons() {
  const t = useExtracted();
  const { actions } = useTodayScreen();

  return (
    <SaveAction action={actions.prepareLessons}>
      {t({
        description: "Button that asks for today's lessons to be made ready.",
        message: "Get today's lessons",
      })}
    </SaveAction>
  );
}

function KeepLearning() {
  const t = useExtracted();
  const { failed, isPending, rowSent, run, wait } = useKeepLearning();
  const speaking = failed || wait !== "none";

  return (
    <TodayBar
      note={
        speaking && (
          <>
            <OpeningWaitLine wait={wait} />

            {failed && (
              <span className="text-destructive-text" role="alert">
                {t("We couldn't open your next lessons. Try again.")}
              </span>
            )}
          </>
        )
      }
    >
      <form action={() => void run()} className="contents">
        <EnterButton busy={isPending && !rowSent} disabled={rowSent} enter="host" type="submit">
          {t("Keep learning")}
        </EnterButton>
      </form>
    </TodayBar>
  );
}

function SeePlanLink() {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const switching = useGoalSwitchPending();

  return (
    <TodayBar>
      <EnterLink enabled={!switching} href={routes.journey}>
        {t("See your plan")}
      </EnterLink>
    </TodayBar>
  );
}

/** Pinned at the page's bottom on a phone and a computer (rule 4); a day with nothing to start has none. */
export function TodayAction() {
  const { today } = useTodayScreen();
  const state = useDayState();
  const pastDate = useTodayPastDate();
  const keepLearning = useUpNextLessons().length > 0;

  if (pastDate) {
    return today.goal.kind === "exam" ? <TodayExamOver /> : <SeePlanLink />;
  }

  if (state === "prepare") {
    return <PrepareLessons />;
  }

  if (keepLearning) {
    return <KeepLearning />;
  }

  if (state === "underway") {
    return <ContinueButton />;
  }

  if (state === "done") {
    return <SummaryLink />;
  }

  if (state === "ahead") {
    return <PracticeTime />;
  }

  return null;
}
