"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { useRouter } from "@/i18n/navigation";
import { GOAL_PARAM } from "@/lib/public/public-hrefs";
import { type GoalError } from "@zoonk/learn/onboarding/goal-errors";
import {
  GOAL_FIELD_TEXT_CLASS,
  GoalField,
  GoalFieldLabel,
  GoalFieldSubmit,
  GoalFieldText,
} from "@zoonk/learn/onboarding/goal-field";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode, useId, useRef, useState } from "react";
import { useSendGoal } from "./use-send-goal";

/** The words in the box and the example under them share one grid cell, so they line up. */
const FIELD_TEXT_CLASS = cn(GOAL_FIELD_TEXT_CLASS, "col-start-1 row-start-1");

/** Why the goal wasn't sent; a guest out of today's goals gets the way to an account. */
function SendErrorAlert({ error, id }: { error: GoalError; id: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-start gap-2" id={id} role="alert">
      <p className="text-destructive-text text-sm">{error.message}</p>
      {error.needsAccount && (
        <CurrentPageLoginLink className="text-foreground text-sm font-medium underline underline-offset-4">
          {t("Create a free account")}
        </CurrentPageLoginLink>
      )}
    </div>
  );
}

/**
 * Where a visitor writes a goal in their own words: what they write goes straight to reading it,
 * and `/start` opens on the wait, prefetched once the box has focus so the wait paints at once.
 * Nothing written puts the cursor in the box instead of sending the example it shows. Without
 * scripts it's a plain GET form to onboarding (`/start?goal=`), which only fills the box there:
 * reading a goal always starts from a tap.
 *
 * `example` sits under the words as the box's example, rendered on the server (the landing's
 * follows the example goal the visitor picked). It wraps rather than being cut, so the box is as
 * tall as its example. Screen readers hear it as the field's description, from a copy of their own
 * (the drawn one is hidden from them), so a page with hidden variants reads only the one shown.
 * The visitor's first letter hides it at once, before scripts run too, so their words never sit
 * on top of it. On phones "Build my plan" sits under the words, so the words keep the field's
 * width.
 *
 * Sending an empty box puts the cursor in it and says what to do in the line under it, in the
 * place of `note` (what starting takes), so nothing moves.
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
  /** A short line under the box, such as "Start free, no account needed." */
  note?: ReactNode;
}) {
  const t = useExtracted();
  const router = useRouter();
  const fieldId = useId();
  const errorId = useId();
  const exampleId = useId();
  const lineId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [hinted, setHinted] = useState(false);
  const { error, send, sending } = useSendGoal();
  const line = hinted ? t("Write your goal in the box first, in your own words.") : note;
  // A new empty send says what to do now, over why an earlier one didn't go.
  const shownError = hinted ? null : error;

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
            void send(goal);
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
              aria-describedby={[shownError && errorId, hinted && lineId, exampleId]
                .filter(Boolean)
                .join(" ")}
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

      {shownError ? (
        <SendErrorAlert error={shownError} id={errorId} />
      ) : (
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
      )}
    </div>
  );
}
