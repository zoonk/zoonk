"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useFormatDuration } from "../_utils/time-format";
import { type DayStep } from "../session/session-types";
import { useTodayScreen } from "./today-context";

export function useIsCatchingUp() {
  const { today } = useTodayScreen();
  const positions = new Set(today.session.catchUp?.positions);

  return (step: DayStep) => positions.has(step.position);
}

/**
 * Offered only while the lessons left take about one more day's time (`offered`), so nobody is
 * offered "+11 hr 52 min".
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

      {failed && <ChangeSaveError className="basis-full" />}
    </div>
  );
}
