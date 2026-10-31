"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { FreeWeekOverNotice } from "../_components/free-week-over";
import { HelpLimitNotice } from "../_components/help-limit-notice";
import { PlusNotice } from "../_components/plus-lock";
import { StudyTimeUsedUpActions } from "../_components/study-time-used-up";
import { TaskActions } from "../_components/task-layout";
import { daysBetween } from "../_utils/iso-date";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { WaitLine } from "../missions/mission-copy";
import { TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { useChallengeScreen } from "./challenge-context";
import { MoveFailed } from "./challenge-move-failed";
import { ChallengeCallPlusNotice, SeePlusAction } from "./challenge-plus-lock";
import { ChallengeUsedUpLine, WeeklyUsedUpLine } from "./challenge-used-up";

function StatusLine({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <p className="text-muted-foreground flex min-h-11 items-start gap-2 py-3 text-sm">
      <LineMarker aria-hidden="true">{icon}</LineMarker>
      <span className="text-pretty">{children}</span>
    </p>
  );
}

function renderNumber(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

function OpensLine() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const icon = <CalendarClockIcon className="size-4" />;

  if (challenge.date) {
    const days = Math.max(1, daysBetween(challenge.today, challenge.date));

    return (
      <StatusLine icon={icon}>
        {t.rich("{count, plural, one {Opens tomorrow} other {Opens in <mono>#</mono> days}}", {
          count: days,
          mono: renderNumber,
        })}
      </StatusLine>
    );
  }

  return <StatusLine icon={icon}>{t("Opens after this phase's lessons")}</StatusLine>;
}

function WaitingLine() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const empty = challenge.questions === 0 && !challenge.call && !challenge.mock;

  if (empty && challenge.date !== null && challenge.date > challenge.today) {
    return <OpensLine />;
  }

  return (
    <StatusLine icon={<CalendarClockIcon className="size-4" />}>
      {empty ? t("This challenge isn't ready yet.") : t("In your next session")}
    </StatusLine>
  );
}

function StartProblem() {
  const t = useExtracted();
  const { start } = useChallengeScreen();

  if (start.problem === "failed") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("That didn't go through. Try again in a moment.")}
      </p>
    );
  }

  if (start.slow) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("Still starting. This is taking longer than usual.")}
      </p>
    );
  }

  return null;
}

function StartButton() {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const { challenge, move, start, writing } = useChallengeScreen();

  if (writing?.kind === "refused") {
    return <HelpLimitNotice limit={writing.limit} linkComponent={LearnLink} routes={routes} />;
  }

  return (
    <>
      <StartProblem />
      <MoveFailed />
      <TaskActions>
        <MoveToMondayButton />
        <TaskMainButton
          busy={start.busy}
          disabled={move.pending}
          onClick={() => void start.start()}
        >
          {start.busy && t("Starting…")}
          {!start.busy && (challenge.mock ? t("Start the mock exam") : t("Start"))}
        </TaskMainButton>
      </TaskActions>
    </>
  );
}

/**
 * A refusal is a fact about the plan this screen can't change, so the move isn't offered again; a
 * failed move keeps it for the retry.
 */
function useMovable(): boolean {
  const { challenge, move } = useChallengeScreen();
  return challenge.canMove && !move.refusal;
}

function MoveToMondayButton({ className, main = false }: { className?: string; main?: boolean }) {
  const t = useExtracted();
  const { move, start } = useChallengeScreen();
  const movable = useMovable();

  if (!movable) {
    return null;
  }

  if (main) {
    return (
      <TaskMainButton
        busy={move.pending}
        disabled={start.busy}
        onClick={() => void move.moveToMonday()}
      >
        {t("Move to Monday")}
      </TaskMainButton>
    );
  }

  return (
    <Button
      className={cn("shrink-0", className)}
      disabled={move.pending || start.busy}
      onClick={() => void move.moveToMonday()}
      size="xl"
      variant="outline"
    >
      {t("Move to Monday")}
    </Button>
  );
}

function ResumeButton() {
  const t = useExtracted();
  const { start } = useChallengeScreen();

  return (
    <TaskActions>
      <TaskMainButton disabled={start.busy} onClick={() => void start.start()}>
        {t("Continue")}
      </TaskMainButton>
    </TaskActions>
  );
}

function OpenLink({ children }: { children: React.ReactNode }) {
  const { hrefs } = useChallengeScreen();

  return hrefs.open ? (
    <TaskActions>
      <TaskMainLink href={hrefs.open}>{children}</TaskMainLink>
    </TaskActions>
  ) : null;
}

function PlusRequiredNotice() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();

  if (challenge.mock) {
    return (
      <PlusNotice cta={false}>
        {t("Mock exams come with Plus: whenever you want, and every week in your plan.")}
      </PlusNotice>
    );
  }

  if (challenge.call) {
    return <ChallengeCallPlusNotice />;
  }

  return <FreeWeekOverNotice cta={false} />;
}

function PlusRequiredFooter() {
  return (
    <>
      <PlusRequiredNotice />
      <SeePlusAction />
    </>
  );
}

function WaitReasonLine({ reason }: { reason: "challenge" | "lessons" }) {
  return (
    <StatusLine icon={<CalendarClockIcon className="size-4" />}>
      <WaitLine reason={reason} />
    </StatusLine>
  );
}

function useStatusFooter(): { actions: React.ReactNode; line: React.ReactNode } {
  const t = useExtracted();
  const { challenge, hrefs, start } = useChallengeScreen();
  const movable = useMovable();

  if (start.problem === "plusRequired") {
    return { actions: <PlusRequiredFooter />, line: null };
  }

  switch (challenge.status) {
    case "ready":
    case "started":
      if (challenge.waitReason) {
        return { actions: null, line: <WaitReasonLine reason={challenge.waitReason} /> };
      }

      if (challenge.status === "ready" && challenge.dailyLimitReached) {
        return {
          actions: (
            <>
              <MoveFailed />
              <StudyTimeUsedUpActions
                href={hrefs.exit}
                main={movable && <MoveToMondayButton main />}
              />
            </>
          ),
          line:
            challenge.kind === "weekly" ? (
              <WeeklyUsedUpLine movable={movable} />
            ) : (
              <ChallengeUsedUpLine
                nextStudyDate={challenge.nextStudyDate}
                today={challenge.today}
              />
            ),
        };
      }

      return {
        actions: challenge.status === "ready" ? <StartButton /> : <ResumeButton />,
        line: null,
      };
    case "tried":
      return {
        actions: <OpenLink>{t("See how it went")}</OpenLink>,
        line: (
          <StatusLine icon={<RotateCcwIcon className="size-4" />}>
            {t(
              "{lessons, plural, =0 {New try tomorrow. Nothing is lost.} one {New try tomorrow, after # short lesson. Nothing is lost.} other {New try tomorrow, after # short lessons. Nothing is lost.}}",
              { lessons: challenge.reinforcementLessons },
            )}
          </StatusLine>
        ),
      };
    case "done":
      return { actions: <OpenLink>{t("See how it went")}</OpenLink>, line: null };
    case "plusRequired":
      return { actions: <PlusRequiredFooter />, line: null };
    case "waiting":
      return { actions: null, line: <WaitingLine /> };
    case "queued":
      return { actions: null, line: <WaitReasonLine reason="challenge" /> };
    case "upcoming":
      return { actions: null, line: <OpensLine /> };
    default:
      return challenge.status satisfies never;
  }
}

/**
 * Where it stands is one polite region that stays in the bar while empty, so the line that replaces
 * a refused Start is read out.
 */
export function ChallengeFooter() {
  const { challenge } = useChallengeScreen();
  const movable = useMovable();
  const { actions, line } = useStatusFooter();
  const startShows = challenge.status === "ready" && challenge.waitReason === null;

  return (
    <>
      <div aria-atomic="true" aria-live="polite" className="empty:absolute" role="status">
        {line}
      </div>
      {actions}
      {!startShows && <MoveFailed />}
      {!startShows && movable && (
        <TaskActions>
          <MoveToMondayButton className="w-full lg:w-auto" />
        </TaskActions>
      )}
    </>
  );
}
