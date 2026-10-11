"use client";

import {
  type SpeakingPaperTaskView,
  type SpeakingTaskView,
} from "@zoonk/core/language/exam-speaking/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../../_components/list-group";
import { PlusMark } from "../../_components/plus-lock";
import { LearnLink } from "../../learn-link";
import { useCriterionGloss, useTaskRoleLabel } from "./exam-speaking-labels";

/** "6–7 min", or "2 min" when the exam gives one length: the exam's own timing. */
export function useTaskMinutes() {
  const t = useExtracted();

  return ({ max, min }: SpeakingTaskView["minutes"]) =>
    min === max
      ? t("{minutes} min", { minutes: String(max) })
      : t("{min}–{max} min", { max: String(max), min: String(min) });
}

/** The exam's preparation for a task: its own, or the time it shares with other tasks. */
function usePrepFact() {
  const t = useExtracted();
  const format = useFormatter();

  return function prepFact(task: SpeakingTaskView): string | null {
    if (task.prepMinutes <= 0) {
      return null;
    }

    return task.prepShared
      ? t("{minutes} min to prepare tasks {tasks}", {
          minutes: String(Math.round(task.prepShared.minutes)),
          tasks: format.list(task.prepShared.tasks.map(String), { type: "conjunction" }),
        })
      : t("{minutes} min to prepare", { minutes: String(Math.round(task.prepMinutes)) });
  };
}

/** A task's facts in one line: whom the learner talks to, the exam's timing, its preparation. */
function useTaskFacts() {
  const roleLabel = useTaskRoleLabel();
  const minutes = useTaskMinutes();
  const prepFact = usePrepFact();

  return (task: SpeakingTaskView) =>
    [roleLabel(task.role), minutes(task.minutes), prepFact(task)]
      .filter((fact) => fact !== null)
      .join(" · ");
}

/**
 * "Last try: 3 of 5 at B2", else how many came near it ("5 of 5 near B2"), else "below B2", or that
 * it has no estimate.
 */
function useLastTryText() {
  const t = useExtracted();

  return (
    { atLevel, nearLevel, rated }: NonNullable<SpeakingPaperTaskView["lastTry"]>,
    level: string,
  ) => {
    if (rated === 0) {
      return t("Last try: no estimate");
    }

    if (atLevel > 0) {
      return t("Last try: {count} of {rated} at {level}", {
        count: String(atLevel),
        level,
        rated: String(rated),
      });
    }

    return nearLevel > 0
      ? t("Last try: {count} of {rated} near {level}", {
          count: String(nearLevel),
          level,
          rated: String(rated),
        })
      : t("Last try: below {level}", { level });
  };
}

/**
 * A task of the paper as a row that opens in place: its official name, whom the learner talks to,
 * its timing and their last try; opened, what it's rated on, its start (Plus) and the last try's
 * result. Without Plus it opens the same, marked Plus, with nothing to start.
 */
export function TaskRow({
  busy,
  defaultOpen,
  index,
  language,
  level,
  locked,
  onStart,
  resultHref,
  starting,
  task,
}: {
  busy: boolean;
  defaultOpen: boolean;
  index: number;
  language: string;
  level: string;
  locked: boolean;
  onStart: () => void;
  resultHref: (conversationId: string) => string;
  starting: boolean;
  task: SpeakingPaperTaskView;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const facts = useTaskFacts();
  const gloss = useCriterionGloss();
  const lastTryText = useLastTryText();

  return (
    <Collapsible data-slot="speaking-task" defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        className={cn(LIST_ROW_INTERACTIVE_CLASS, "group/task")}
        id={getTaskRowId(task.key)}
      >
        <ListRowLeading>
          <ListRowIcon className="text-foreground text-sm font-semibold tabular-nums">
            {index + 1}
          </ListRowIcon>
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle lang={language}>{task.name}</ListRowTitle>
          <ListRowDescription>{facts(task)}</ListRowDescription>
          {task.lastTry && (
            <ListRowDescription>{lastTryText(task.lastTry, level)}</ListRowDescription>
          )}
        </ListRowContent>
        {locked && (
          <ListRowTrailing>
            <PlusMark />
          </ListRowTrailing>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-data-panel-open/task:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="flex flex-col items-start gap-3 ps-15 pe-4 pt-1 pb-4">
          <p className="text-muted-foreground text-sm text-pretty">
            {t("Rated on {criteria}.", {
              criteria: format.list(
                task.criteria.map((criterion) => gloss(criterion)),
                { type: "conjunction" },
              ),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {!locked && (
              <Button disabled={busy} onClick={onStart} size="sm">
                {starting ? t("Starting…") : t("Start this task")}
              </Button>
            )}
            {task.lastTry && (
              <LearnLink
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={resultHref(task.lastTry.conversationId)}
              >
                {t("See your last result")}
              </LearnLink>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function getTaskRowId(task: string): string {
  return `speaking-task-${task}`;
}
