"use client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@zoonk/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useActionState, useId } from "react";
import { type StartPlanState } from "./start-plan-action";

const MINUTE_CHOICES = ["10", "15", "20", "30", "45", "60", "90"] as const;
const DEFAULT_MINUTES = "20";

/** The learner picks their own daily time; nothing else of the owner's plan is theirs to copy. */
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
    <form action={formAction} className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor={minutesId}>
        {t("How much time a day?")}
      </label>
      <NativeSelect defaultValue={DEFAULT_MINUTES} id={minutesId} name="dailyMinutes">
        {MINUTE_CHOICES.map((minutes) => (
          <NativeSelectOption key={minutes} value={minutes}>
            {t("{minutes, number} min", { minutes: Number(minutes) })}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button disabled={isPending} size="lg" type="submit">
        {t("Start from this plan")}
      </Button>
      {state && "error" in state && state.error === "refused" && (
        <p className="text-destructive text-sm" role="alert">
          {t("You can't add another goal right now. Finish or pause one first.")}
        </p>
      )}
      {state && "error" in state && state.error === "failed" && (
        <p className="text-destructive text-sm" role="alert">
          {t("That didn't work. Try again in a moment.")}
        </p>
      )}
    </form>
  );
}
