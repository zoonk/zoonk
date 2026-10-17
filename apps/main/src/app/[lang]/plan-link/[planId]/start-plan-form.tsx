"use client";

import { useRouter } from "@/i18n/navigation";
import { DailyMinutesChoice } from "@zoonk/learn/onboarding/daily-minutes";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { type StartPlanState } from "./start-plan-action";

const DEFAULT_MINUTES = 30;

/**
 * The learner picks their own daily time, from the same presets onboarding asks it with; nothing
 * else of the owner's plan is theirs to copy. It renders inside the learn messages' scope.
 */
export function StartPlanForm({
  action,
}: {
  action: (state: StartPlanState, formData: FormData) => Promise<StartPlanState>;
}) {
  const t = useExtracted();
  const minutesId = useId();

  const router = useRouter();
  // The timezone is read in the learner's browser when they submit; a started plan opens next.
  const [state, formAction, isPending] = useActionState(
    async (previous: StartPlanState, formData: FormData) => {
      formData.set("timeZone", getLocalTimeZone());
      const result = await action(previous, formData);

      if (result && "started" in result) {
        router.push("/plan");
      }

      return result;
    },
    null,
  );

  return (
    <form action={formAction} aria-labelledby={minutesId} className="flex flex-col gap-3">
      <p className="text-sm font-medium" id={minutesId}>
        {t("How much time a day?")}
      </p>
      <DailyMinutesChoice defaultMinutes={DEFAULT_MINUTES} name="dailyMinutes" />
      <Button
        aria-keyshortcuts="Enter"
        className="mt-1"
        disabled={isPending}
        size="lg"
        type="submit"
      >
        {t("Start from this plan")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </Button>
      {state && "error" in state && state.error === "refused" && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("You can't start another goal right now. Finish or pause one first.")}
        </p>
      )}
      {state && "error" in state && state.error === "failed" && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("That didn't work. Try again in a moment.")}
        </p>
      )}
    </form>
  );
}
