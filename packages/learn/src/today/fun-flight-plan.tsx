"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, RocketIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { OftenTestedTag } from "../session/often-tested-tag";
import { type StudyBlock } from "../session/session-types";
import { useBlockDetail, useBlockKindLabel, useBlockTitle } from "../session/use-block-copy";
import { useTodayScreen } from "./today-context";
import { TodayDayDone } from "./today-day-done";
import { useContinueSession } from "./use-continue-session";
import { useLessonBeingWritten, useSessionState } from "./use-today-copy";

const FLIGHT_PLAN_TITLE_ID = "today-flight-plan-title";

/** Each kind of stop keeps its color, so the day reads at a glance. */
const TILE_TONES: Record<StudyBlock["kind"], string> = {
  checkpoint: "fun-card-magenta",
  learn: "fun-card-indigo",
  practice: "fun-card-emerald",
  produce: "fun-card-violet",
  review: "fun-card-teal",
};

function isFinished(block: StudyBlock): boolean {
  return block.status === "completed" || block.status === "skipped";
}

/**
 * Capsules name what's inside; every other stop (a warm-up of questions without capsules
 * included) names itself and says what it teaches.
 */
function useNextStopText() {
  const t = useExtracted();
  const title = useBlockTitle();
  const detail = useBlockDetail();
  const isBeingWritten = useLessonBeingWritten();

  return (block: StudyBlock) =>
    block.kind === "review" && block.capsules.length > 0
      ? {
          line: block.capsules.map((capsule) => capsule.title).join(", "),
          title: t("{count, plural, one {# capsule to open} other {# capsules to open}}", {
            count: block.capsules.length,
          }),
        }
      : {
          line: isBeingWritten(block)
            ? t("Being written for you. It's usually ready in a minute or two.")
            : (block.canDo ?? detail(block)),
          title: title(block),
        };
}

function NextStopTile({ block }: { block: StudyBlock }) {
  const t = useExtracted();
  const kindLabel = useBlockKindLabel();
  const text = useNextStopText()(block);

  return (
    <article
      aria-label={t("Next stop")}
      className={cn("fun-card fun-holo-border flex flex-col gap-2 p-5", TILE_TONES[block.kind])}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fun-fg2 text-xs font-bold tracking-[0.14em] uppercase">
          {kindLabel(block)}
        </p>
        <OftenTestedTag show={block.oftenTested} />
      </div>
      <h3 className="font-fun-display text-2xl leading-tight font-bold wrap-break-word">
        {text.title}
      </h3>
      {text.line && <p className="text-fun-fg2 text-sm leading-relaxed">{text.line}</p>}

      <p className="mt-1 flex items-center gap-4 text-sm font-semibold tabular-nums">
        <span>{t("{minutes} min", { minutes: String(block.estimatedMinutes) })}</span>
        <span className="text-fun-lime">
          {t("+{points} BP", { points: String(block.estimatedBrainPower) })}
        </span>
      </p>
    </article>
  );
}

function StopTile({ block }: { block: StudyBlock }) {
  const t = useExtracted();
  const kindLabel = useBlockKindLabel();
  const title = useBlockTitle();
  const isBeingWritten = useLessonBeingWritten();
  const finished = isFinished(block);

  return (
    <li
      className={cn(
        "fun-card flex min-h-20 flex-col gap-1 rounded-2xl p-3",
        TILE_TONES[block.kind],
        finished && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-fun-fg2 text-xs font-bold tracking-[0.12em] uppercase">
          {kindLabel(block)}
        </p>

        {finished && (
          <LineMarker className="text-xs">
            <span className="bg-fun-soft flex size-6 items-center justify-center rounded-full">
              <CheckIcon aria-hidden="true" className="size-3.5" />
              <span className="sr-only">{t("Done")}</span>
            </span>
          </LineMarker>
        )}
      </div>
      <p className="text-sm font-semibold wrap-break-word">
        {block.kind === "review" && block.capsules.length > 0
          ? t("{count, plural, one {# capsule} other {# capsules}}", {
              count: block.capsules.length,
            })
          : title(block)}
      </p>
      <p className="text-fun-fg2 text-xs tabular-nums">
        {!finished && isBeingWritten(block)
          ? t("Being written…")
          : t("{minutes} min", { minutes: String(block.estimatedMinutes) })}
      </p>
      <OftenTestedTag show={block.oftenTested && !finished} />
    </li>
  );
}

function TakeOffButton() {
  const t = useExtracted();
  const { started } = useSessionState();
  const { failed, isPending, run } = useContinueSession();

  return (
    <div className="flex flex-col gap-2">
      <Button
        aria-keyshortcuts="Enter"
        className="h-14 w-full rounded-full text-lg"
        disabled={isPending}
        onClick={run}
        size="xl"
        variant="lime"
      >
        <RocketIcon aria-hidden="true" />
        {started ? t("Keep flying") : t("Take off")}
        <ShortcutKbd>Enter</ShortcutKbd>
      </Button>

      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("We couldn't open the next stop. Try again.")}
        </p>
      )}
    </div>
  );
}

/**
 * Today as a flight plan: three to five stops, the next one big with what the learner will be
 * able to do, its minutes and what it's worth, and one button: Take off.
 */
export function FunFlightPlan() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { session } = today;
  const { done, limitReached } = useSessionState();
  const next = session.blocks.find((block) => block.id === session.nextBlockId);
  const others = session.blocks.filter((block) => block.id !== session.nextBlockId);

  return (
    <section aria-labelledby={FLIGHT_PLAN_TITLE_ID} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-fun-display text-xl font-bold" id={FLIGHT_PLAN_TITLE_ID}>
          {t("Flight plan")}
        </h2>
        <p className="text-fun-fg2 text-sm tabular-nums">
          {t(
            "{stops, plural, one {# stop} other {# stops}} · {done, plural, other {# done}} · {minutes} min",
            {
              done: session.blocks.filter((block) => isFinished(block)).length,
              minutes: String(session.minutes.planned),
              stops: session.blocks.length,
            },
          )}
        </p>
      </header>

      <div className={cn("grid gap-3", next && others.length > 0 && "lg:grid-cols-[1fr_15rem]")}>
        {next && <NextStopTile block={next} />}

        {others.length > 0 && (
          <ol
            aria-label={t("Other stops")}
            className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3", next && "lg:grid-cols-1")}
          >
            {others.map((block) => (
              <StopTile block={block} key={block.id} />
            ))}
          </ol>
        )}
      </div>

      {done || limitReached ? <TodayDayDone /> : <TakeOffButton />}
    </section>
  );
}
