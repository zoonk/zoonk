"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type StudyBlock } from "../session/session-types";
import { useTodayScreen } from "./today-context";

/** "4 min". */
function useMinutes() {
  const t = useExtracted();
  return (minutes: number) => t("{minutes} min", { minutes: String(minutes) });
}

/** A block that catches up on lessons earlier days left. */
export function useIsCatchingUp() {
  const { today } = useTodayScreen();
  const blockIds = new Set(today.session.catchUp?.blockIds);

  return (block: StudyBlock) => blockIds.has(block.id);
}

/**
 * Lessons earlier days left that today's normal time doesn't fit: they come first on the next
 * days, or, with one tap, today, and the learner is back on pace once they're done.
 */
export function CatchUpLater() {
  const t = useExtracted();
  const formatMinutes = useMinutes();
  const { actions, today } = useTodayScreen();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const later = today.session.catchUp?.later;

  if (!later || later.lessons === 0) {
    return null;
  }

  const catchUp = () =>
    startTransition(async () => {
      setFailed(!(await actions.catchUp()));
    });

  return (
    <div className="flex flex-col gap-2 border-t pt-4" data-slot="today-catch-up">
      <p className="text-muted-foreground text-sm">
        {t(
          "{lessons, plural, one {# more lesson to catch up comes first tomorrow.} other {# more lessons to catch up come first tomorrow.}}",
          { lessons: later.lessons },
        )}
      </p>

      <Button
        className="self-start"
        disabled={isPending}
        focusableWhenDisabled
        onClick={catchUp}
        size="sm"
        variant="outline"
      >
        {t("Catch up today · +{time}", { time: formatMinutes(later.minutes) })}
      </Button>

      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't add them. Try again.")}
        </p>
      )}
    </div>
  );
}
