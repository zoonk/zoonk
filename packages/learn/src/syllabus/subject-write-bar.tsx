"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { ClockIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { EnterButton, EnterLink } from "../_components/enter-button";
import { useFormatDuration } from "../_utils/time-format";
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

  if (actions.length > 0 && actions.every((action) => action.availability.status === "tomorrow")) {
    return (
      <BottomBar>
        <p className="text-muted-foreground flex min-h-11 items-center justify-center gap-2 text-sm lg:justify-end">
          <ClockIcon aria-hidden="true" className="size-4" />
          {t("Back tomorrow: no more grading today")}
        </p>
      </BottomBar>
    );
  }

  return (
    <BottomBar>
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
