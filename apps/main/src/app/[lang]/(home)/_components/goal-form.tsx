"use client";

import { Link } from "@/i18n/navigation";
import { GOAL_PARAM } from "@/lib/public/public-hrefs";
import { type GoalError } from "@zoonk/learn/onboarding/goal-errors";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useSendGoal } from "./use-send-goal";

/** Long enough to read the longest example before the next one fades in. */
const EXAMPLE_MS = 3500;

const FIELD_SHADOW =
  "bg-card shadow-[0_0_0_1px_rgb(0_0_0/0.09),0_2px_4px_rgb(0_0_0/0.04),0_24px_48px_-24px_rgb(0_0_0/0.28)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.12)]";

/** The words in the box and the example under them share one grid cell, so they line up. */
const FIELD_TEXT_CLASS = "col-start-1 row-start-1 py-3 text-[17px] leading-snug sm:text-lg";

/**
 * Which example the box shows: the next one every few seconds, until the visitor starts on their
 * own goal. With reduced motion, the first one stays.
 */
function useShownExample({ count, stopped }: { count: number; stopped: boolean }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (stopped || reducedMotion || count < 2) {
      return;
    }

    const timer = setInterval(() => setShown((current) => (current + 1) % count), EXAMPLE_MS);
    return () => clearInterval(timer);
  }, [count, stopped]);

  return shown;
}

/**
 * The box's placeholder: every example stacked in the same place, so the box is as tall as the
 * longest one and doesn't move while they take turns. Screen readers skip it; the field's name
 * stays the same.
 */
function GoalExamples({
  examples,
  hidden,
  shown,
}: {
  examples: string[];
  hidden: boolean;
  shown: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        FIELD_TEXT_CLASS,
        "text-muted-foreground pointer-events-none grid py-0 select-none",
        hidden && "invisible",
      )}
    >
      {examples.map((example, index) => (
        <span
          className={cn(
            FIELD_TEXT_CLASS,
            "transition-[opacity,visibility] motion-reduce:transition-none",
            // The last example is gone before the next one fades in, so their words never overlap.
            index === shown
              ? "opacity-100 delay-200 duration-500 ease-out"
              : "invisible opacity-0 duration-200 ease-in",
          )}
          key={example}
        >
          {example}
        </span>
      ))}
    </span>
  );
}

/** Why the goal wasn't sent; a guest out of today's goals gets the way to an account. */
function SendErrorAlert({ error, id }: { error: GoalError; id: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-start gap-2" id={id} role="alert">
      <p className="text-destructive text-sm">{error.message}</p>
      {error.needsAccount && (
        <Link
          className="text-foreground text-sm font-medium underline underline-offset-4"
          href="/login"
        >
          {t("Create a free account")}
        </Link>
      )}
    </div>
  );
}

/**
 * The goal box's form: what the visitor writes goes straight to reading it, and `/start` opens on
 * the wait. Nothing written puts the cursor in the box instead of sending the example it shows.
 * Without scripts it's a plain GET form to onboarding (`/start?goal=`), which only fills the box
 * there: reading a goal always starts from a tap.
 */
export function GoalForm({
  action,
  examples,
  id,
  variant,
}: {
  action: string;
  examples: string[];
  id: string;
  variant: "card" | "pill";
}) {
  const t = useExtracted();
  const fieldId = useId();
  const errorId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [started, setStarted] = useState(false);
  const [hasWords, setHasWords] = useState(false);
  const shown = useShownExample({ count: examples.length, stopped: started });
  const { error, send, sending } = useSendGoal();

  const isPill = variant === "pill";

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <form
        action={action}
        aria-busy={sending}
        className={cn(
          FIELD_SHADOW,
          "focus-within:ring-ring/40 flex flex-col gap-2 rounded-3xl p-2 text-left focus-within:ring-[3px] sm:rounded-[26px] sm:p-2.5",
          isPill &&
            "sm:min-h-[68px] sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:py-2 sm:pl-7",
        )}
        id={id}
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          const goal = fieldRef.current?.value.trim() ?? "";

          if (!goal) {
            fieldRef.current?.focus();
          } else if (!sending) {
            void send(goal);
          }
        }}
      >
        <div
          className={cn(
            "flex flex-col gap-0.5 px-3 pt-2.5 sm:px-3.5 sm:pt-3",
            isPill && "sm:min-w-0 sm:flex-1 sm:flex-row sm:items-baseline sm:gap-2 sm:p-0",
          )}
        >
          <label
            className="text-muted-foreground text-sm whitespace-nowrap sm:text-base"
            htmlFor={fieldId}
          >
            {t("I want to")}
          </label>

          <div className="-my-3 grid min-w-0 flex-1">
            <GoalExamples examples={examples} hidden={hasWords} shown={shown} />

            <textarea
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
              className={cn(
                FIELD_TEXT_CLASS,
                "field-sizing-content max-h-48 w-full min-w-0 resize-none bg-transparent outline-none",
              )}
              enterKeyHint="go"
              id={fieldId}
              name={GOAL_PARAM}
              onChange={(event) => setHasWords(event.target.value !== "")}
              onFocus={() => setStarted(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              readOnly={sending}
              ref={fieldRef}
              rows={1}
            />
          </div>
        </div>

        <button
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 self-end px-5 text-base",
            isPill && "sm:self-center",
          )}
          disabled={sending}
          type="submit"
        >
          {t("Start")}
          {sending && <Spinner aria-hidden="true" data-icon="inline-end" />}
        </button>
      </form>

      {error && <SendErrorAlert error={error} id={errorId} />}
    </div>
  );
}
