"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarClockIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { FreeWeekOverNotice } from "../_components/free-week-over";
import { HelpLimitNotice } from "../_components/help-limit-notice";
import { PlusNotice } from "../_components/plus-lock";
import { TaskActions } from "../_components/task-layout";
import { daysBetween, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { WaitLine } from "../missions/mission-copy";
import { TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { useChallengeScreen } from "./challenge-context";
import { ChallengeCallPlusNotice, SeePlusAction } from "./challenge-plus-lock";

/**
 * Where the challenge stands when it can't start yet, as one quiet line in the action bar, where
 * Start will be, on the column's left edge like every line there.
 */
function StatusLine({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <p className="text-muted-foreground flex min-h-11 items-start gap-2 py-3 text-sm">
      <LineMarker aria-hidden="true">{icon}</LineMarker>
      <span className="text-pretty">{children}</span>
    </p>
  );
}

/** A count in a sentence, in the mono face like every number. */
function renderMono(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

/**
 * Before its day: how far away it is ("Opens in 6 days"), since the card above already says which
 * day. A phase's checkpoint also opens once its lessons are done.
 */
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
          mono: renderMono,
        })}
      </StatusLine>
    );
  }

  return <StatusLine icon={icon}>{t("Opens after this phase's lessons")}</StatusLine>;
}

/**
 * Due, but today's session was planned without it: the next one has it. A checkpoint with nothing
 * known to have nothing to ask yet (zero questions, not an unknown count, call or mock) can't
 * promise that: before its day it says when it opens, and from its day that it isn't ready.
 */
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

  if (start.problem === "dailyLimitReached") {
    return (
      <p className="text-muted-foreground text-sm" role="alert">
        {t("You've reached today's study time. It'll be here tomorrow.")}
      </p>
    );
  }

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

  // Its questions need writing and the learner's AI help doesn't cover them now: say why, with
  // the one thing to do.
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
 * A move or its undo that didn't go through. A mock the days before Monday can't save its time for
 * says so, with the day and its real length; one onto a day that already has a mock says that.
 * Either way the plan stays as it was.
 */
export function MoveFailed() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();
  const { move } = useChallengeScreen();

  if (move.refusal?.kind === "mockCollision") {
    return (
      <p className="text-destructive-text text-sm text-pretty" role="alert">
        {t("That day already has a mock exam. Pick another day.")}
      </p>
    );
  }

  if (move.refusal?.kind === "unfundedMove") {
    const { date, minutes } = move.refusal.unfundedMove;

    return (
      <p className="text-destructive-text text-sm text-pretty" role="alert">
        {t("Not enough study time before {date} for this {duration} mock exam. Pick a later day.", {
          date: formatDate(date),
          duration: formatDuration(minutes),
        })}
      </p>
    );
  }

  if (!move.failed) {
    return null;
  }

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("That didn't go through. Try again in a moment.")}
    </p>
  );
}

/** The second option beside Start: the week's challenge can wait for Monday, before it starts. */
function MoveToMondayButton({ className }: { className?: string }) {
  const t = useExtracted();
  const { challenge, move, start } = useChallengeScreen();

  if (!challenge.canMove) {
    return null;
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

/** Its block, running or finished, opens on its own screen. */
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

/** A finished block's result opens without resuming its clock. */
function OpenLink({ children }: { children: React.ReactNode }) {
  const { hrefs } = useChallengeScreen();

  return hrefs.open ? (
    <TaskActions>
      <TaskMainLink href={hrefs.open}>{children}</TaskMainLink>
    </TaskActions>
  ) : null;
}

/**
 * What Plus unlocks here, said once beside "See Plus": a mock, a language goal's call (the same
 * call Plus learners get, which the plan doesn't wait for), or a free exam plan's phase challenge
 * once its first week is over.
 */
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

/** A challenge the learner's plan leaves to Plus: what Plus unlocks, and "See Plus" for Start. */
function PlusRequiredFooter() {
  return (
    <>
      <PlusRequiredNotice />
      <SeePlusAction />
    </>
  );
}

/** Today's saved order puts other work first: the day's lessons, or the challenge before it. */
function WaitReasonLine({ reason }: { reason: "challenge" | "lessons" }) {
  return (
    <StatusLine icon={<CalendarClockIcon className="size-4" />}>
      <WaitLine reason={reason} />
    </StatusLine>
  );
}

/**
 * What the footer says about the challenge today, and nothing more: the line saying where it
 * stands, and what the learner can do. A Start or Continue refused because Plus lapsed since the
 * intro opened shows the lock right away, while the host reloads the challenge. One that today's
 * saved order puts after other work (`waitReason`, the rule Start applies) says what comes first,
 * as the day's row does, instead of offering a Start that refuses.
 */
function useStatusFooter(): { actions: React.ReactNode; line: React.ReactNode } {
  const t = useExtracted();
  const { challenge, start } = useChallengeScreen();

  if (start.problem === "plusRequired") {
    return { actions: <PlusRequiredFooter />, line: null };
  }

  switch (challenge.status) {
    case "ready":
    case "started":
      if (challenge.waitReason) {
        return { actions: null, line: <WaitReasonLine reason={challenge.waitReason} /> };
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
 * The challenge's pinned action bar: Start, with Move to Monday beside it, or where it stands, with
 * Move to Monday under it while it can still wait for Monday (the bar's width on a phone, its
 * label's from `lg`, like every action there). Where it stands is one polite region that stays in
 * the bar, out of the layout while it's empty, so the line that replaces a refused Start ("In your
 * next session", "After today's lessons") is read out whole without moving focus.
 */
export function ChallengeFooter() {
  const { challenge } = useChallengeScreen();
  const { actions, line } = useStatusFooter();
  const startShows = challenge.status === "ready" && challenge.waitReason === null;

  return (
    <>
      <div aria-atomic="true" aria-live="polite" className="empty:absolute">
        {line}
      </div>
      {actions}
      {!startShows && <MoveFailed />}
      {!startShows && challenge.canMove && (
        <TaskActions>
          <MoveToMondayButton className="w-full lg:w-auto" />
        </TaskActions>
      )}
    </>
  );
}
