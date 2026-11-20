"use client";

import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { ListPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useFormatDuration } from "../_utils/time-format";
import { useTodayScreen } from "./today-context";
import { useWelcomeBack } from "./use-today-copy";

/**
 * Lessons left from earlier days, offered only while they take about one more day's time
 * (`offered`), so nobody is offered "+11 hr 52 min", and never before a learner back from days
 * away has started.
 */
export function EarlierLessons() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { actions, today } = useTodayScreen();
  const welcomeBack = useWelcomeBack();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const later = today.session.catchUp?.later;

  if (!later?.offered || later.lessons === 0 || welcomeBack) {
    return null;
  }

  const addToToday = () =>
    startTransition(async () => {
      const { data: added } = await safeAsync(actions.catchUp);
      setFailed(!added);
    });

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
      data-slot="today-earlier-lessons"
    >
      <p className="flex min-w-0 items-baseline gap-2 text-sm">
        {t(
          "{lessons, plural, one {# lesson from earlier days} other {# lessons from earlier days}}",
          { lessons: later.lessons },
        )}
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {formatDuration(later.minutes)}
        </span>
      </p>

      <form action={() => addToToday()} className="contents">
        <Button
          busy={isPending}
          icon={<ListPlusIcon aria-hidden="true" />}
          size="sm"
          type="submit"
          variant="outline"
        >
          {t("Add to today")}
        </Button>
      </form>

      {failed && <ChangeSaveError className="basis-full" />}
    </div>
  );
}
