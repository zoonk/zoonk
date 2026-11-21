"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { ClockIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { EnterButton, EnterLink } from "../_components/enter-button";
import { useFormatDuration } from "../_utils/time-format";
import { ChooseOnToday } from "../writing/writing-choice";
import { useGradingReturnsLine } from "../writing/writing-labels";
import { type WrittenSubject } from "./subject-written-score";

/** A written test's own facts, as its notice states them: "2 questions · 3 h 30 min · 50% of the score". */
export function useWrittenFacts({
  minutes,
  questions,
  share,
}: Pick<WrittenSubject, "minutes" | "questions" | "share">): string[] {
  const t = useExtracted();
  const format = useFormatter();
  const formatDuration = useFormatDuration();

  return [
    questions && t("{count, plural, one {# question} other {# questions}}", { count: questions }),
    minutes && formatDuration(minutes),
    share &&
      t("{share} of the score", {
        share: format.number(share, { maximumFractionDigits: 0, style: "percent" }),
      }),
  ].filter((fact) => typeof fact === "string");
}

type WriteAction = NonNullable<WrittenSubject["writeActions"]>[number];

/**
 * The exam choices some of the part's tasks wait for, and whether every task does, so there's
 * nothing to write until they're made. A server without write actions says it for the whole part.
 */
function getPendingChoice(written: WrittenSubject): { all: boolean; groups: string[] } | null {
  const actions = written.writeActions ?? [];

  if (actions.length === 0) {
    return written.availability?.status === "needsChoice"
      ? { all: true, groups: written.availability.choiceGroups }
      : null;
  }

  const groups = actions.flatMap(({ availability }) =>
    availability.status === "needsChoice" ? availability.choiceGroups : [],
  );

  const all = actions.every(({ availability }) => availability.status === "needsChoice");

  return groups.length > 0 ? { all, groups: [...new Set(groups)] } : null;
}

/** When every task's grading is used up for today, the first day one returns. */
function getReturnsOn(actions: readonly WriteAction[]): string | null {
  const days = actions.map(({ availability }) =>
    availability.status === "tomorrow" ? availability.returnsOn : null,
  );

  if (days.length === 0 || days.some((day) => day === null)) {
    return null;
  }

  return days.filter((day) => day !== null).toSorted()[0] ?? null;
}

/**
 * A written part's main action is writing: its lessons are a small part of its time. An unfinished
 * task opens where it was left, and once the day's grading is used the bar says when it returns
 * instead of offering a tap that would be refused.
 */
export function WriteBottomBar({
  essayHref,
  write,
  written,
}: {
  essayHref: (blockId: string) => string;
  write: () => Promise<boolean>;
  written: WrittenSubject;
}) {
  const t = useExtracted();
  const gradingReturns = useGradingReturnsLine();
  const [busy, setBusy] = useState(false);
  const actions = written.writeActions ?? [];
  const unfinished = actions.find((action) => action.availability.status === "continue");

  if (unfinished?.blockId) {
    return (
      <BottomBar>
        <BottomBarActions>
          <EnterLink
            className={DETAIL_PRIMARY_CLASS}
            href={essayHref(unfinished.blockId)}
            size="lg"
          >
            {t("Continue")}
          </EnterLink>
        </BottomBarActions>
      </BottomBar>
    );
  }

  const choice = getPendingChoice(written);
  const choiceNote = choice && <ChooseOnToday choiceGroups={choice.groups} />;

  if (choice?.all) {
    return (
      <BottomBar>
        <div className="flex min-h-11 items-center lg:justify-end">{choiceNote}</div>
      </BottomBar>
    );
  }

  const returnsOn = getReturnsOn(actions);

  if (returnsOn) {
    return (
      <BottomBar>
        <p className="text-muted-foreground flex min-h-11 items-center justify-center gap-2 text-sm lg:justify-end">
          <ClockIcon aria-hidden="true" className="size-4" />
          {gradingReturns(returnsOn)}
        </p>
      </BottomBar>
    );
  }

  return (
    <BottomBar note={choiceNote}>
      <BottomBarActions>
        <EnterButton
          busy={busy}
          className={DETAIL_PRIMARY_CLASS}
          onClick={async () => {
            setBusy(true);

            if (!(await write())) {
              setBusy(false);
            }
          }}
          size="lg"
        >
          {t("Write")}
        </EnterButton>
      </BottomBarActions>
    </BottomBar>
  );
}
