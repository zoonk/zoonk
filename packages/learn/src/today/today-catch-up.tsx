"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { useFormatDuration } from "../_utils/time-format";
import { type StudyBlock } from "../session/session-types";
import { useTodayScreen } from "./today-context";

/** A block that catches up on lessons earlier days left. */
export function useIsCatchingUp() {
  const { today } = useTodayScreen();
  const blockIds = new Set(today.session.catchUp?.blockIds);

  return (block: StudyBlock) => blockIds.has(block.id);
}

/**
 * Lessons earlier days left that today's normal time doesn't fit: they come first on the next
 * days, and while they take about one more day's time (`offered`), one tap adds them to today and
 * the learner is back on pace once they're done. More than that only says the next days take them,
 * so nobody is offered "+11 hr 52 min". The day before an exam has no next day for them: they're
 * there if the learner has time today, and it says nothing when they don't fit. Offered while the
 * day is underway and after it's done, as one quiet line under the day.
 */
export function CatchUpLater() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { actions, today } = useTodayScreen();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const later = today.session.catchUp?.later;
  const { examTomorrow } = today.session;

  if (!later || later.lessons === 0 || (examTomorrow && !later.offered)) {
    return null;
  }

  if (!later.offered) {
    return (
      <p className="text-muted-foreground text-[0.8125rem] leading-snug" data-slot="today-catch-up">
        {t(
          "{lessons, plural, one {Your next days start with the # lesson left to catch up.} other {Your next days start with the # lessons left to catch up.}}",
          { lessons: later.lessons },
        )}
      </p>
    );
  }

  const catchUp = () =>
    startTransition(async () => {
      setFailed(!(await actions.catchUp()));
    });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-slot="today-catch-up">
      <p className="text-muted-foreground text-[0.8125rem] leading-snug">
        {examTomorrow
          ? t(
              "{lessons, plural, one {You can still catch up on # lesson today, if you have time.} other {You can still catch up on # lessons today, if you have time.}}",
              { lessons: later.lessons },
            )
          : t(
              "{lessons, plural, one {# more lesson to catch up comes first tomorrow.} other {# more lessons to catch up come first tomorrow.}}",
              { lessons: later.lessons },
            )}
      </p>

      <Button
        disabled={isPending}
        focusableWhenDisabled
        onClick={catchUp}
        size="sm"
        variant="outline"
      >
        {t("Catch up today · +{time}", { time: formatDuration(later.minutes) })}
      </Button>

      {failed && (
        <p className="text-destructive-text basis-full text-sm" role="alert">
          {t("We couldn't add them. Try again.")}
        </p>
      )}
    </div>
  );
}
