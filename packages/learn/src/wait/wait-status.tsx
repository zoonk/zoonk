"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ProgressRing } from "../_components/progress-ring";
import { useFormatShare } from "../_utils/percent";
import { type GenerationFirstLesson } from "../generation/generation-run";
import { WAIT_NARROW_ONLY_CLASS } from "./use-wait-view";
import { useWaitScreen } from "./wait-screen";

const MARK_CLASS = "col-start-1 flex h-5 items-center justify-center";

/** The ring closes into a check as the work finishes; both stay drawn so one fades into the other. */
function StatusMark({ done, share }: { done: boolean; share: number }) {
  return (
    <span aria-hidden="true" className={cn(MARK_CLASS, "relative row-start-1")}>
      <ProgressRing
        className={cn(
          "duration-base absolute size-4 transition-opacity ease-out",
          done && "opacity-0",
        )}
        share={share}
      />
      <CheckIcon
        className={cn(
          "text-success duration-base absolute size-4 transition-opacity ease-out",
          !done && "opacity-0",
        )}
      />
    </span>
  );
}

/**
 * What the wait is building, as one strip over the quiz: tapping it shows the work's progress.
 * `value` is the progress from 0 to 100; `line` says what else is being made, such as lesson 1.
 */
export function WaitStatus({
  children,
  done,
  line,
  value,
}: {
  children: string;
  done: boolean;
  line?: React.ReactNode;
  value: number;
}) {
  const formatShare = useFormatShare();
  const { aside, openProgress, statusRef } = useWaitScreen();

  return (
    <div className={cn("border-border border-b pb-3", aside && WAIT_NARROW_ONLY_CLASS)}>
      <button
        className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 grid w-[calc(100%+1rem)] grid-cols-[1rem_minmax(0,1fr)_1rem] gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-[3px]"
        data-slot="wait-status"
        onClick={openProgress}
        ref={statusRef}
        type="button"
      >
        <StatusMark done={done} share={value / 100} />

        <span className="col-start-2 row-start-1 text-[0.9375rem] leading-5 font-medium">
          {children}
          <span className="sr-only">{`, ${formatShare(done ? 1 : value / 100)}`}</span>
        </span>

        <ChevronRightIcon
          aria-hidden="true"
          className="text-muted-foreground col-start-3 row-start-1 size-4 self-center"
        />

        {line}
      </button>
    </div>
  );
}

function LessonTitle(chunks: React.ReactNode) {
  return <span className="text-foreground">{chunks}</span>;
}

/** Lesson 1's line under the strip, for a goal whose first lesson is written before its plan. */
export function FirstLessonLine({ lesson }: { lesson: GenerationFirstLesson }) {
  const t = useExtracted();

  // Once it's done, the wait is for the plan alone.
  if (lesson.status === "done") {
    return null;
  }

  if (lesson.status === "ready") {
    return (
      <>
        <span aria-hidden="true" className={cn(MARK_CLASS, "row-start-2")}>
          <CheckIcon className="text-success size-4" />
        </span>
        <span className="text-muted-foreground col-start-2 row-start-2 text-sm leading-5">
          {t("Your first lesson is ready")}
        </span>
      </>
    );
  }

  return (
    <span className="text-muted-foreground col-span-2 col-start-2 row-start-2 text-sm leading-5 text-pretty">
      {t.rich("Writing your first lesson: <lesson>{title}</lesson>", {
        lesson: LessonTitle,
        title: lesson.title,
      })}
    </span>
  );
}
