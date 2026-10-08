"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CalendarClockIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlusNotice } from "../_components/plus-lock";
import { useLearnRoutes } from "../learn-context";
import { TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { useChallengeScreen } from "./challenge-context";
import { daysBetween } from "./challenge-labels";

/** Where the challenge stands when it can't start yet, as a status pill the eye finds. */
function StatusLine({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <p className="bg-muted text-foreground flex items-center gap-2 self-center rounded-full px-4 py-2 text-center text-sm font-medium">
      <LineMarker aria-hidden="true">{icon}</LineMarker>
      <span className="text-balance">{children}</span>
    </p>
  );
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
        {t("{count, plural, one {Opens tomorrow} other {Opens in # days}}", { count: days })}
      </StatusLine>
    );
  }

  return <StatusLine icon={icon}>{t("Opens after this phase's lessons")}</StatusLine>;
}

function StartProblem() {
  const t = useExtracted();
  const { start } = useChallengeScreen();

  if (start.problem === "dailyLimitReached") {
    return (
      <p className="text-muted-foreground text-center text-sm" role="alert">
        {t("You've reached today's study time. It'll be here tomorrow.")}
      </p>
    );
  }

  if (start.problem === "failed") {
    return (
      <p className="text-destructive text-center text-sm" role="alert">
        {t("That didn't go through. Try again in a moment.")}
      </p>
    );
  }

  if (start.slow) {
    return (
      <p className="text-muted-foreground text-center text-sm" role="status">
        {t("Still starting. This is taking longer than usual.")}
      </p>
    );
  }

  return null;
}

function StartButton() {
  const t = useExtracted();
  const { challenge, move, start } = useChallengeScreen();

  return (
    <>
      <StartProblem />
      <TaskMainButton busy={start.busy} disabled={move.pending} onClick={() => void start.start()}>
        {start.busy && t("Starting…")}
        {!start.busy && (challenge.mock ? t("Start the mock exam") : t("Start"))}
      </TaskMainButton>
    </>
  );
}

/** A move or its undo that didn't go through. */
export function MoveFailed() {
  const t = useExtracted();
  const { move } = useChallengeScreen();

  if (!move.failed) {
    return null;
  }

  return (
    <p className="text-destructive text-center text-sm" role="alert">
      {t("That didn't go through. Try again in a moment.")}
    </p>
  );
}

/** The quiet second option: the week's challenge can wait for Monday, before it starts. */
function MoveToMondayButton() {
  const t = useExtracted();
  const { challenge, move, start } = useChallengeScreen();

  if (!challenge.canMove) {
    return null;
  }

  return (
    <>
      <MoveFailed />
      <Button
        className="w-full"
        disabled={move.pending || start.busy}
        onClick={() => void move.moveToMonday()}
        size="lg"
        variant="ghost"
      >
        {t("Move to Monday")}
      </Button>
    </>
  );
}

/** Its block, running or finished, opens on its own screen. */
function OpenLink({ children }: { children: React.ReactNode }) {
  const { hrefs } = useChallengeScreen();
  return hrefs.open ? <TaskMainLink href={hrefs.open}>{children}</TaskMainLink> : null;
}

/** The footer says what the learner can do with the challenge today, and nothing more. */
function StatusFooter() {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const { challenge } = useChallengeScreen();

  switch (challenge.status) {
    case "ready":
      return <StartButton />;
    case "started":
      return <OpenLink>{t("Continue")}</OpenLink>;
    case "tried":
      return (
        <>
          <StatusLine icon={<RotateCcwIcon className="size-4" />}>
            {t("New try tomorrow, after {lessons} short lessons. Nothing is lost.", {
              lessons: String(challenge.reinforcementLessons),
            })}
          </StatusLine>
          <OpenLink>{t("See how it went")}</OpenLink>
        </>
      );
    case "done":
      return <OpenLink>{t("See how it went")}</OpenLink>;
    case "plusRequired":
      return (
        <>
          <PlusNotice cta={false}>
            {t("Mock exams come with Plus: whenever you want, and every week in your plan.")}
          </PlusNotice>
          <TaskMainLink href={routes.upgrade}>{t("See Plus")}</TaskMainLink>
        </>
      );
    case "waiting":
      return (
        <StatusLine icon={<CalendarClockIcon className="size-4" />}>
          {t("In your next session")}
        </StatusLine>
      );
    case "upcoming":
      return <OpensLine />;
    default:
      return challenge.status satisfies never;
  }
}

export function ChallengeFooter() {
  return (
    <>
      <StatusFooter />
      <MoveToMondayButton />
    </>
  );
}
