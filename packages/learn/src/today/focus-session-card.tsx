"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleIcon, CircleMinusIcon, CirclePlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { OftenTestedTag } from "../session/often-tested-tag";
import { type StudyBlock } from "../session/session-types";
import { useBlockDetail, useBlockTitle } from "../session/use-block-copy";
import { useTodayScreen } from "./today-context";
import { TodayDayDone } from "./today-day-done";
import { useContinueSession } from "./use-continue-session";
import { useLessonBeingWritten, useSessionState } from "./use-today-copy";

const SESSION_CARD_TITLE_ID = "today-session-title";

function BlockIcon({ block, isNext }: { block: StudyBlock; isNext: boolean }) {
  const className = "size-5 shrink-0";

  if (block.status === "completed") {
    return <CircleCheckIcon aria-hidden="true" className={cn(className, "text-success")} />;
  }

  if (block.status === "skipped") {
    return (
      <CircleMinusIcon aria-hidden="true" className={cn(className, "text-muted-foreground")} />
    );
  }

  if (isNext) {
    return <CirclePlayIcon aria-hidden="true" className={className} />;
  }

  return <CircleIcon aria-hidden="true" className={cn(className, "text-muted-foreground/60")} />;
}

function BlockRow({ block, isNext }: { block: StudyBlock; isNext: boolean }) {
  const t = useExtracted();
  const title = useBlockTitle();
  const detail = useBlockDetail();
  const isBeingWritten = useLessonBeingWritten();
  const finished = block.status === "completed" || block.status === "skipped";
  const line = !finished && isBeingWritten(block) ? t("Being written for you…") : detail(block);

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5", isNext && "bg-muted")}
    >
      <LineMarker>
        <BlockIcon block={block} isNext={isNext} />
      </LineMarker>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("font-medium", finished && "text-muted-foreground font-normal")}>
          {title(block)}
          {block.status === "completed" && <span className="sr-only">{t(", done")}</span>}
          {block.status === "skipped" && <span className="sr-only">{t(", skipped")}</span>}
        </span>
        {line && <span className="text-muted-foreground text-sm">{line}</span>}
        <OftenTestedTag className="mt-1" show={block.oftenTested && !finished} />
      </div>

      <LineMarker>
        <span className="text-muted-foreground text-sm tabular-nums">
          {t("{minutes} min", { minutes: String(block.estimatedMinutes) })}
        </span>
      </LineMarker>
    </li>
  );
}

function ContinueButton() {
  const t = useExtracted();
  const { started } = useSessionState();
  const { failed, isPending, run } = useContinueSession();

  return (
    <div className="flex flex-col gap-2">
      <Button
        aria-keyshortcuts="Enter"
        className="h-12 w-full rounded-full text-base"
        disabled={isPending}
        onClick={run}
        size="lg"
      >
        {started ? t("Continue") : t("Start")}
        <ShortcutKbd tone="inverse">Enter</ShortcutKbd>
      </Button>

      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("We couldn't open the next step. Try again.")}
        </p>
      )}
    </div>
  );
}

/**
 * Today's session in Focus: every block with its can-do line and minutes, the time done against
 * the day's goal, and a single Continue.
 */
export function FocusSessionCard() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { session } = today;
  const { done, limitReached } = useSessionState();
  const share = session.minutes.planned > 0 ? session.minutes.done / session.minutes.planned : 0;

  return (
    <section
      aria-labelledby={SESSION_CARD_TITLE_ID}
      className="bg-card flex flex-col gap-4 rounded-3xl border p-4 shadow-sm sm:p-6"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold" id={SESSION_CARD_TITLE_ID}>
          {t("Today's session")}
        </h2>
        <p className="text-muted-foreground text-sm tabular-nums">
          {t("{done} of {planned} min", {
            done: String(session.minutes.done),
            planned: String(session.minutes.planned),
          })}
        </p>
      </header>

      <Meter>
        <MeterFill
          className="transition-[width] duration-500 motion-reduce:transition-none"
          share={share}
        />
      </Meter>

      <ol className="-mx-3 flex flex-col gap-0.5">
        {session.blocks.map((block) => (
          <BlockRow block={block} isNext={block.id === session.nextBlockId} key={block.id} />
        ))}
      </ol>

      {done || limitReached ? <TodayDayDone /> : <ContinueButton />}
    </section>
  );
}
