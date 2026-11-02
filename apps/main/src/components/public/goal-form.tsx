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
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useSendGoal } from "./use-send-goal";

const FIELD_TEXT_CLASS = cn(GOAL_FIELD_TEXT_CLASS, "col-start-1 row-start-1");

type ExampleChoices = { examples: Readonly<Record<string, string>>; name: string };

/**
 * Without scripts it's a plain GET form that only fills onboarding's box: reading a goal always
 * starts from a tap. The button sits beside the words only when the longest example fits there on
 * one line, and what the visitor types never moves it. Screen readers hear the example from a copy
 * of their own, so a page with hidden variants reads only the one shown. Picking one of
 * `exampleChoices`' radios writes its example into the box when the box is empty or still holds an
 * earlier pick, never over the visitor's words.
 */
export function GoalForm({
  action,
  example,
  exampleChoices,
  id,
  note,
}: {
  action: string;
  example: ReactNode;
  exampleChoices?: ExampleChoices;
  id: string;
  note?: ReactNode;
}) {
  const t = useExtracted();
  const router = useRouter();
  const fieldId = useId();
  const exampleId = useId();
  const lineId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const filledRef = useRef("");
  const [hinted, setHinted] = useState(false);
  const send = useSendGoal();
  const [sending, startSending] = useTransition();
  const line = hinted ? t("Write your goal in the box first, in your own words.") : note;
  const choicesName = exampleChoices?.name;

  const fillExample = useEffectEvent((event: Event) => {
    const field = fieldRef.current;
    const choice = event.target;

    if (!field || !(choice instanceof HTMLInputElement) || choice.name !== choicesName) {
      return;
    }

    const picked = exampleChoices?.examples[choice.value];

    if (picked && (field.value.trim() === "" || field.value === filledRef.current)) {
      field.value = picked;
      filledRef.current = picked;
      setHinted(false);
    }
  });

  useEffect(() => {
    if (!choicesName) {
      return;
    }

    document.addEventListener("change", fillExample);
    document.addEventListener("click", fillExample);

    return () => {
      document.removeEventListener("change", fillExample);
      document.removeEventListener("click", fillExample);
    };
  }, [choicesName]);

  return (
    <div className="flex w-full flex-col gap-4">
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
            startSending(() => send(goal));
          }
        }}
      >
        <div className="flex min-w-0 flex-auto items-start gap-2 pr-2.5">
          <GoalFieldLabel htmlFor={fieldId}>{t("I want to")}</GoalFieldLabel>

          <div className="group/goal grid min-w-0 flex-1">
            <span
              aria-hidden="true"
              className={cn(
                FIELD_TEXT_CLASS,
                "text-muted-foreground contrast-more:text-foreground/60 pointer-events-none min-w-0 text-pretty select-none",
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
