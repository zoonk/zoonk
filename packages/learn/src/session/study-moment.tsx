"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CalendarClockIcon, CheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { useExperienceMode } from "../mode-provider";
import { SessionBar } from "./session-bar";
import { type StudyBlock, type StudyMomentView } from "./session-types";
import { useSessionAction } from "./use-session-action";

type MomentKind = StudyBlock["kind"];

function useMomentTitle({ kind, testedOut }: { kind: MomentKind; testedOut: boolean }) {
  const t = useExtracted();
  const mode = useExperienceMode();

  if (kind === "learn") {
    return testedOut ? t("You already knew this") : t("Lesson complete");
  }

  if (kind === "review") {
    return mode === "fun" ? t("Capsules opened") : t("Review done");
  }

  return t("Practice done");
}

/** When the lesson's ideas come back: Fun seals them in a capsule with its opening date. */
function ComesBack({ date }: { date: string }) {
  const t = useExtracted();
  const format = useFormatter();
  const mode = useExperienceMode();

  const day = format.dateTime(new Date(`${date}T00:00:00Z`), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  });

  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm">
      <LineMarker>
        <CalendarClockIcon aria-hidden="true" className="size-4" />
      </LineMarker>
      {mode === "fun"
        ? t("Capsule sealed. It opens {day}, when recalling it helps it stick.", { day })
        : t("This comes back for a quick review on {day}.", { day })}
    </p>
  );
}

function ScoreLine({ moment }: { moment: StudyMomentView }) {
  const t = useExtracted();

  if (moment.total === 0) {
    return null;
  }

  if (moment.netScore !== null) {
    return (
      <p className="text-muted-foreground">
        {t(
          "Net score {net}: {right, plural, =0 {# right} one {# right} other {# right}}, {wrong, plural, =0 {# wrong} one {# wrong} other {# wrong}}",
          {
            net: String(moment.netScore),
            right: moment.correct,
            // A statement left blank counts for neither, so wrong answers are what the net took away.
            wrong: moment.correct - moment.netScore,
          },
        )}
      </p>
    );
  }

  return (
    <p className="text-muted-foreground">
      {t("{correct} of {total} right", {
        correct: String(moment.correct),
        total: String(moment.total),
      })}
    </p>
  );
}

function BrainPower({ moment }: { moment: StudyMomentView }) {
  const t = useExtracted();
  const mode = useExperienceMode();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="bg-muted/60 in-data-[mode=fun]:fun-glass flex w-fit flex-col rounded-2xl px-4 py-3">
        <span className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold tabular-nums">
          {t("+{points}", { points: String(moment.brainPower) })}
        </span>
        <span className="text-muted-foreground text-xs">{t("Brain Power")}</span>
      </div>

      {mode === "fun" && moment.fullMeal.paid && (
        <span className="bg-fun-lime text-fun-lime-foreground rounded-full px-3 py-1.5 text-sm font-bold">
          {t("Full meal: +{bonus} BP", { bonus: String(moment.fullMeal.bonus) })}
        </span>
      )}
    </div>
  );
}

function StopButton({ onStop }: { onStop: () => Promise<boolean> }) {
  const t = useExtracted();
  const { isPending, run } = useSessionAction({ action: onStop });

  return (
    <Button className="self-center" disabled={isPending} onClick={run} size="sm" variant="ghost">
      {t("Stop for today")}
    </Button>
  );
}

/**
 * The quick moment after a session block or a lesson: a check, what it earned, one more step on
 * the session bar and, for a lesson, when it comes back. One tap (or Enter) keeps going; the full
 * summary waits for the end of the session.
 */
export function StudyMoment({
  children,
  kind,
  moment,
  onContinue,
  onStop,
  inLessonPlayer = false,
  testedOut = false,
}: {
  /** Extra content under the moment, such as the lesson's thumbs. */
  children?: React.ReactNode;
  kind: MomentKind;
  moment: StudyMomentView;
  onContinue: () => Promise<boolean>;
  /** "Stop for today" between blocks: what's done counts, the rest waits without penalty. */
  onStop: () => Promise<boolean>;
  /**
   * Inside the lesson player, whose header already shows the session bar and holds the page's
   * heading (the lesson's title), so the moment's title sits under it.
   */
  inLessonPlayer?: boolean;
  testedOut?: boolean;
}) {
  const t = useExtracted();
  const title = useMomentTitle({ kind, testedOut });
  const { failed, isPending, run } = useSessionAction({ action: onContinue, enterKey: true });
  const Title = inLessonPlayer ? "h2" : "h1";

  return (
    <section className="flex flex-col gap-6 py-6" data-slot="study-moment">
      <span className="bg-success/10 text-success in-data-[mode=fun]:animate-fun-ceremony in-data-[mode=fun]:bg-fun-lime in-data-[mode=fun]:text-fun-lime-foreground flex size-14 items-center justify-center rounded-full">
        <CheckIcon aria-hidden="true" className="size-7" />
      </span>

      <div className="flex flex-col gap-1" role="status">
        <Title className="in-data-[mode=fun]:font-fun-display text-3xl font-semibold tracking-tight">
          {title}
        </Title>
        <ScoreLine moment={moment} />
      </div>

      <BrainPower moment={moment} />
      {moment.comesBackOn && <ComesBack date={moment.comesBackOn} />}

      <div className="flex flex-col gap-2">
        {!inLessonPlayer && (
          <SessionBar completed={moment.sessionBar.completed} total={moment.sessionBar.total} />
        )}
        <p className="text-muted-foreground text-xs tabular-nums">
          {t("{completed} of {total} done today", {
            completed: String(moment.sessionBar.completed),
            total: String(moment.sessionBar.total),
          })}
        </p>
      </div>

      {children}

      <div className="flex flex-col gap-2">
        <EnterButton disabled={isPending} onClick={run}>
          {moment.sessionCompleted ? t("See what changed") : t("Continue")}
        </EnterButton>

        {failed && (
          <p className="text-destructive text-center text-sm" role="alert">
            {t("We couldn't open the next step. Try again.")}
          </p>
        )}

        {!moment.sessionCompleted && <StopButton onStop={onStop} />}
      </div>
    </section>
  );
}
