"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarCheckIcon, CalendarClockIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { HelpLimitWords, LimitMainAction, useLiveLimit } from "../_components/help-limit-notice";
import { ChangeSaveError } from "../_components/save-error";
import { StatusRegion } from "../_components/status-region";
import { GateWords, SubscribeMainAction } from "../_components/subscribe-gate";
import { TaskActions } from "../_components/task-layout";
import { ChallengeCallGate } from "../language/conversation/challenge-call-gate";
import { MockPreparingNote } from "../mock/mock-preparing";
import { MockSchedule } from "../mock/mock-schedule";
import { TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { useChoiceLine } from "../writing/writing-choice";
import { useChallengeScreen } from "./challenge-context";
import { useMoveFailed } from "./challenge-move-failed";
import { OpensLine, StatusLine, WaitingLine } from "./challenge-status-line";

function useStartProblem(): React.ReactNode {
  const t = useExtracted();
  const { start } = useChallengeScreen();

  if (start.problem === "failed") {
    return <ChangeSaveError>{t("That didn't go through. Try again in a moment.")}</ChangeSaveError>;
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
  const { move, start } = useChallengeScreen();

  return (
    <TaskActions>
      <ScheduleButton />
      <TaskMainButton busy={start.busy} disabled={move.pending} onClick={() => void start.start()}>
        {t("Start")}
      </TaskMainButton>
    </TaskActions>
  );
}

/**
 * A refusal is a fact about the plan this screen can't change, so the move isn't offered again; a
 * failed move keeps it for the retry.
 */
function useMovable(): boolean {
  const { challenge, move } = useChallengeScreen();

  if (challenge.mock) {
    return (
      challenge.access !== "plusRequired" &&
      challenge.date !== null &&
      (challenge.status === "ready" ||
        challenge.status === "upcoming" ||
        challenge.status === "waiting")
    );
  }

  return challenge.canMove && !move.refusal;
}

function ScheduleButton({ className }: { className?: string }) {
  const t = useExtracted();
  const { challenge, move, start } = useChallengeScreen();
  const movable = useMovable();

  if (!movable) {
    return null;
  }

  if (challenge.mock) {
    return <MockSchedule planItemId={challenge.planItemId} disabled={start.busy} />;
  }

  return (
    <Button
      busy={move.pending}
      className={cn("shrink-0", className)}
      disabled={start.busy}
      focusableWhenDisabled
      icon={<CalendarCheckIcon aria-hidden="true" />}
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
      <TaskMainButton busy={start.busy} onClick={() => void start.start()}>
        {t("Continue")}
      </TaskMainButton>
    </TaskActions>
  );
}

function KeepStudyingLink() {
  const t = useExtracted();
  const { hrefs } = useChallengeScreen();

  return (
    <TaskActions>
      <ScheduleButton />
      <TaskMainLink href={hrefs.exit}>{t("Keep studying")}</TaskMainLink>
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
    return <GateWords title={t("Mock exams need a subscription")} />;
  }

  if (challenge.call) {
    return <ChallengeCallGate form="words" />;
  }

  return null;
}

function useStatusFooter(): { actions: React.ReactNode; line: React.ReactNode } {
  const t = useExtracted();
  const { challenge, hrefs, start, writing } = useChallengeScreen();
  const writingLimit = useLiveLimit(writing?.kind === "refused" ? writing.limit : null);
  const choiceLine = useChoiceLine();

  if (start.problem === "plusRequired") {
    return { actions: <SubscribeMainAction />, line: <PlusRequiredNotice /> };
  }

  // The mock's written test waits for an exam choice, which Today asks.
  if (typeof start.problem === "object" && start.problem !== null) {
    return {
      actions: (
        <TaskActions>
          <TaskMainLink href={hrefs.exit}>{t("Choose on Today")}</TaskMainLink>
        </TaskActions>
      ),
      line: (
        <StatusLine icon={<CalendarClockIcon className="size-4" />}>
          {choiceLine(start.problem.choiceGroups)}
        </StatusLine>
      ),
    };
  }

  switch (challenge.status) {
    case "ready":
    case "started":
      if (challenge.waitReason) {
        return {
          actions: null,
          line: (
            <StatusLine icon={<CalendarClockIcon className="size-4" />}>
              {t("After today's lessons")}
            </StatusLine>
          ),
        };
      }

      if (isPreparing({ challenge, start })) {
        return { actions: <KeepStudyingLink />, line: null };
      }

      if (challenge.status === "ready" && writingLimit) {
        return {
          actions: <LimitMainAction limit={writingLimit} />,
          line: <HelpLimitWords limit={writingLimit} />,
        };
      }

      return {
        actions: challenge.status === "ready" ? <StartButton /> : <ResumeButton />,
        line: null,
      };
    case "tried":
      return {
        actions: <OpenLink>{t("See result")}</OpenLink>,
        line: (
          <StatusLine icon={<RotateCcwIcon className="size-4" />}>
            {t(
              "{lessons, plural, =0 {Rematch tomorrow.} one {Rematch tomorrow, after # short lesson.} other {Rematch tomorrow, after # short lessons.}}",
              { lessons: challenge.reinforcementLessons },
            )}
          </StatusLine>
        ),
      };
    case "done":
      return { actions: <OpenLink>{t("See result")}</OpenLink>, line: null };
    case "plusRequired":
      return { actions: <SubscribeMainAction />, line: <PlusRequiredNotice /> };
    case "waiting":
      return { actions: null, line: <WaitingLine /> };
    case "queued":
    case "upcoming":
      return { actions: null, line: <OpensLine /> };
    default:
      return challenge.status satisfies never;
  }
}

type ScreenState = Pick<ReturnType<typeof useChallengeScreen>, "challenge" | "start">;

function isPreparing({ challenge, start }: ScreenState) {
  return (
    start.problem !== "plusRequired" &&
    (challenge.status === "ready" || challenge.status === "started") &&
    !challenge.waitReason &&
    (challenge.access === "preparing" || start.problem === "preparing")
  );
}

function usePreparingNote(): React.ReactNode {
  const t = useExtracted();
  const screen = useChallengeScreen();
  const { mockWriting, start } = screen;

  return isPreparing(screen) ? (
    <MockPreparingNote
      goalId={screen.challenge.goalId}
      surface="scheduledMock"
      title={t("Getting your mock exam ready")}
      wait={{
        read: mockWriting.read,
        written: () => {
          start.clearProblem();
          mockWriting.written();
        },
      }}
    />
  ) : null;
}

export function useChallengeFooterNote(): React.ReactNode {
  const { challenge } = useChallengeScreen();
  const preparing = usePreparingNote();
  const startProblem = useStartProblem();
  const moveFailed = useMoveFailed();
  const startShows = challenge.status === "ready" && challenge.waitReason === null;
  const start = startShows && !preparing ? startProblem : null;

  return (
    (preparing || start || moveFailed) && (
      <>
        {preparing}
        {start}
        {moveFailed}
      </>
    )
  );
}

export function ChallengeFooter() {
  const { challenge } = useChallengeScreen();
  const movable = useMovable();
  const { actions, line } = useStatusFooter();
  const startShows = challenge.status === "ready" && challenge.waitReason === null;
  const moves = !startShows && movable;

  // With nothing else to press, a computer reads the status and the move as one line.
  if (moves && !actions) {
    return (
      <TaskActions className="max-lg:flex-col max-lg:items-stretch max-lg:gap-0 lg:gap-4">
        <StatusRegion className="lg:me-auto">{line}</StatusRegion>
        <ScheduleButton />
      </TaskActions>
    );
  }

  return (
    <>
      <StatusRegion>{line}</StatusRegion>
      {actions}
      {moves && (
        <TaskActions>
          <ScheduleButton className="w-full lg:w-auto" />
        </TaskActions>
      )}
    </>
  );
}
