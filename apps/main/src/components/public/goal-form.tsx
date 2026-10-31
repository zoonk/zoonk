"use client";

import { useRouter } from "@/i18n/navigation";
import { GOAL_PARAM } from "@/lib/public/public-hrefs";
import {
  GOAL_FIELD_TEXT_CLASS,
  GoalField,
  GoalFieldLabel,
  GoalFieldSubmit,
  GoalFieldText,
} from "@zoonk/learn/onboarding/goal-field";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode, useId, useRef, useState, useTransition } from "react";
import { useSendGoal } from "./use-send-goal";

const FIELD_TEXT_CLASS = cn(GOAL_FIELD_TEXT_CLASS, "col-start-1 row-start-1");

/**
 * Without scripts it's a plain GET form that only fills onboarding's box: reading a goal always
 * starts from a tap. Screen readers hear the example from a copy of their own, so a page with hidden
 * variants reads only the one shown.
 */
export function GoalForm({
  action,
  example,
  id,
  note,
}: {
  action: string;
  example: ReactNode;
  id: string;
  note?: ReactNode;
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
  const line = hinted ? t("Write your goal in the box first, in your own words.") : note;

  return (
    <div className="flex w-full flex-col gap-4">
      <GoalField
        action={action}
        aria-busy={sending}
        className="flex-col items-stretch sm:flex-row sm:items-end"
        id={id}
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          const goal = fieldRef.current?.value.trim() ?? "";

          if (!goal) {
            setHinted(true);
            fieldRef.current?.focus();
          } else if (!sending) {
            startSending(() => send(goal));
          }
        }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2 pr-2.5 sm:pr-0">
          <GoalFieldLabel htmlFor={fieldId}>{t("I want to")}</GoalFieldLabel>

          <div className="group/goal grid min-w-0 flex-1">
            <span
              aria-hidden="true"
              className={cn(
                FIELD_TEXT_CLASS,
                "text-muted-foreground pointer-events-none min-w-0 text-pretty select-none",
                // The field's own state (it holds words), so it's right before scripts run and without them.
                "group-has-[textarea:not(:placeholder-shown)]/goal:invisible",
              )}
              data-slot="goal-example"
            >
              {example}
            </span>

            <span className="sr-only" id={exampleId}>
              {t.rich("For example: <example></example>", { example: () => example })}
            </span>

            <GoalFieldText
              aria-describedby={[hinted && lineId, exampleId].filter(Boolean).join(" ")}
              aria-invalid={hinted || undefined}
              className="col-start-1 row-start-1"
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

        <GoalFieldSubmit className="self-end" disabled={sending} pending={sending}>
          {t("Build my plan")}
        </GoalFieldSubmit>
      </GoalField>

      <p
        aria-live="polite"
        id={lineId}
        className={cn(
          "text-muted-foreground -mt-1 text-[13px]",
          hinted && "text-foreground",
          !line && "sr-only",
        )}
      >
        {line}
      </p>
    </div>
  );
}
