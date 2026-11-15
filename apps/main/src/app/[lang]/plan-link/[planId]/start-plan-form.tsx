"use client";

import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { useRouter } from "@/i18n/navigation";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { DailyTimeField } from "@zoonk/learn/daily-time-picker";
import { EnterButton } from "@zoonk/learn/enter-button";
import { safeAsync } from "@zoonk/utils/error";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useActionState, useId, useRef } from "react";
import { type StartPlanState } from "./start-plan-action";

const DEFAULT_MINUTES = 30;

export function StartPlanForm({
  action,
}: {
  action: (state: StartPlanState, formData: FormData) => Promise<StartPlanState>;
}) {
  const t = useExtracted();
  const minutesId = useId();
  const form = useRef<HTMLFormElement>(null);

  const router = useRouter();

  const [state, formAction, isPending] = useActionState(
    async (previous: StartPlanState, formData: FormData) => {
      formData.set("timeZone", getLocalTimeZone());

      const { data } = await safeAsync(() => answerHere(action(previous, formData), openingHere()));

      const answered = data ?? "failed";

      if (answered === "left") {
        return previous;
      }

      const result: StartPlanState =
        answered === "failed" ? { failure: { status: "failed" } } : answered.answer;

      if (result && "started" in result) {
        router.push("/plan");
      }

      return result;
    },
    null,
  );

  const failure = state && "failure" in state ? state.failure : null;

  return (
    <form
      action={formAction}
      aria-labelledby={minutesId}
      className="flex flex-col gap-3"
      ref={form}
    >
      <p className="text-sm font-medium" id={minutesId}>
        {t("How much time a day?")}
      </p>
      <DailyTimeField defaultMinutes={DEFAULT_MINUTES} name="dailyMinutes" />
      {failure?.status === "limitReached" ? (
        <CourseStartFailureNote failure={failure} onRetry={() => form.current?.requestSubmit()} />
      ) : (
        <EnterButton busy={isPending} className="mt-1" size="lg" type="submit">
          {t({
            description:
              "Button under a study plan someone else shared: the reader gets a plan of their own for the same subject.",
            message: "Start my own plan",
          })}
        </EnterButton>
      )}
      {failure && failure.status !== "limitReached" && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("That didn't work. Try again in a moment.")}
        </p>
      )}
    </form>
  );
}
