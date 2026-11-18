"use client";

import { useRouter } from "@/i18n/navigation";
import { GOAL_PARAM } from "@/lib/public/public-hrefs";
import { useResetWhenDone } from "@/lib/use-reset-when-done";
import {
  GoalField,
  GoalFieldExample,
  GoalFieldLabel,
  GoalFieldSubmit,
  GoalFieldText,
} from "@zoonk/learn/onboarding/goal-field";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode, useId, useRef, useState, useTransition } from "react";
import { PageStartMark } from "./page-start";
import { useSendGoal } from "./use-send-goal";

/**
 * Without scripts it's a plain GET form that only fills onboarding's box: reading a goal always
 * starts from a tap. The button sits beside the words only when the example fits there on one line,
 * and what the visitor types never moves it.
 */
export function GoalForm({
  action,
  example,
  id,
  note,
  noteClassName,
}: {
  action: string;
  example: ReactNode;
  id: string;
  note?: ReactNode;
  noteClassName?: string;
}) {
  const t = useExtracted();
  const router = useRouter();
  const fieldId = useId();
  const exampleId = useId();
  const lineId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [hinted, setHinted] = useState(false);
  const send = useSendGoal();
  const [sending, startSending] = useTransition();
  const reset = useResetWhenDone();
  const line = hinted ? t("Write your goal in the box first, in your own words.") : note;

  return (
    <div className="flex w-full flex-col gap-4" key={reset.key}>
      <PageStartMark />
      <GoalField
        action={action}
        aria-busy={sending}
        className="flex-wrap justify-end"
        id={id}
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          const goal = fieldRef.current?.value.trim() ?? "";

          if (!goal) {
            setHinted(true);
            fieldRef.current?.focus();
          } else if (!sending) {
            reset.done();
            startSending(() => send(goal));
          }
        }}
      >
        <div className="flex min-w-0 flex-auto items-start gap-2">
          <GoalFieldLabel htmlFor={fieldId}>{t("I want to")}</GoalFieldLabel>

          <div className="group/goal grid min-w-0 flex-1">
            <GoalFieldExample>{example}</GoalFieldExample>

            <span className="sr-only" id={exampleId}>
              {t.rich("For example: <example></example>", { example: () => example })}
            </span>

            <GoalFieldText
              aria-describedby={[hinted && lineId, exampleId].filter(Boolean).join(" ")}
              aria-invalid={hinted || undefined}
              className="col-start-1 row-start-1 contain-inline-size"
              id={fieldId}
              name={GOAL_PARAM}
              onFocus={() => router.prefetch("/start")}
              onInput={() => setHinted(false)}
              // A blank placeholder makes `:placeholder-shown` say whether the box is empty.
              placeholder=" "
              readOnly={sending}
              ref={fieldRef}
            />
          </div>
        </div>

        <GoalFieldSubmit busy={sending} className="self-end" data-action-name="build-plan">
          {t("Build my plan")}
        </GoalFieldSubmit>
      </GoalField>

      <p
        aria-live="polite"
        id={lineId}
        className={cn(
          "text-muted-foreground text-compact -mt-1",
          hinted && "text-foreground",
          !line && "sr-only",
          noteClassName,
        )}
      >
        {line}
      </p>
    </div>
  );
}
