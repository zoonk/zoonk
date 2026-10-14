"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useRef } from "react";

/**
 * The words in the field and anything stacked in the same place (the landing's rotating examples)
 * share one size, so they line up.
 */
export const GOAL_FIELD_TEXT_CLASS = "py-2.5 text-[17px] leading-6";

/**
 * The panel onboarding's boxes are written in (the goal, a rewrite of it, a question about the
 * learner's material): the stronger line, which takes the app's field focus while its words have
 * focus (the line in the ring's color and a 3px ring around it, as `Input` draws), so someone on
 * a keyboard sees where they are. The buttons inside draw their own.
 */
export const GOAL_PANEL_CLASS =
  "bg-card inset-ring-input has-[textarea:focus-visible]:inset-ring-ring has-[textarea:focus-visible]:ring-ring/50 rounded-xl inset-ring transition-shadow has-[textarea:focus-visible]:ring-[3px] motion-reduce:transition-none";

/**
 * The one place a goal is written, on the landing and on `/start`: a panel with the stronger line,
 * the words, and "Build my plan ⏎" inside it. Put a `GoalFieldText` (or the words' own grid) and a
 * `GoalFieldSubmit` inside; anything before the words (the paperclip, the "I want to" label)
 * goes first.
 */
export function GoalField({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      className={cn(
        GOAL_PANEL_CLASS,
        "flex min-h-14 items-end gap-2 p-1.5 pl-4 text-left",
        className,
      )}
      data-slot="goal-field"
      {...props}
    />
  );
}

/** A quiet word before the goal ("I want to"), on the words' first line, naming the field `htmlFor`. */
export function GoalFieldLabel({
  children,
  className,
  htmlFor,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
}) {
  return (
    <label
      className={cn(
        GOAL_FIELD_TEXT_CLASS,
        "text-muted-foreground shrink-0 self-start whitespace-nowrap",
        className,
      )}
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

/**
 * The goal's words: one line that grows with them. Enter sends (Shift+Enter breaks the line). On
 * a device with a mouse or trackpad it takes focus when it shows (`autoFocusOnPointer`); on a phone
 * it waits for a tap, so the keyboard doesn't cover what's under it.
 */
export function GoalFieldText({
  autoFocusOnPointer = false,
  className,
  onKeyDown,
  ref,
  ...props
}: Omit<React.ComponentProps<"textarea">, "ref"> & {
  autoFocusOnPointer?: boolean;
  ref?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = ref ?? ownRef;

  useEffect(() => {
    if (autoFocusOnPointer && globalThis.matchMedia("(pointer: fine)").matches) {
      fieldRef.current?.focus();
    }
  }, [autoFocusOnPointer, fieldRef]);

  return (
    <textarea
      autoComplete="off"
      className={cn(
        GOAL_FIELD_TEXT_CLASS,
        "placeholder:text-muted-foreground field-sizing-content max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent outline-none",
        className,
      )}
      enterKeyHint="go"
      onKeyDown={(event) => {
        onKeyDown?.(event);

        if (
          !event.defaultPrevented &&
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      ref={fieldRef}
      rows={1}
      {...props}
    />
  );
}

/** "Build my plan ⏎": the field's inverted button, busy while the goal is on its way. */
export function GoalFieldSubmit({
  children,
  className,
  pending = false,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type" | "variant"> & { pending?: boolean }) {
  return (
    <Button
      aria-keyshortcuts="Enter"
      className={cn("shrink-0 px-4", className)}
      size="lg"
      type="submit"
      {...props}
    >
      {children}
      {pending ? (
        <Spinner aria-hidden="true" data-icon="inline-end" />
      ) : (
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      )}
    </Button>
  );
}
