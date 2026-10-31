"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useRef } from "react";
import { useKeptTyping } from "../../use-kept-typing";

export const GOAL_FIELD_TEXT_CLASS = "py-2.5 text-[17px] leading-6";

const GOAL_FIELD = "goal";

/**
 * The box is uncontrolled (`defaultValue`, with `field` spread on it), so a tap before the form's
 * code arrived is sent once it has, with what was typed.
 */
export function useGoalFieldAction({
  canSendEmpty = false,
  onSend,
}: {
  canSendEmpty?: boolean;
  onSend: (goal: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = (words: string) => {
    const goal = words.trim();

    if (goal || canSendEmpty) {
      onSend(goal);
      return;
    }

    ref.current?.focus();
  };

  const action = (data: FormData) => {
    const words = data.get(GOAL_FIELD);
    send(typeof words === "string" ? words : "");
  };

  const fill = (words: string) => {
    const field = ref.current;

    if (field) {
      field.value = words;
      field.focus();
    }
  };

  return { action, field: { name: GOAL_FIELD, ref }, fill, send };
}

/**
 * Words focused on their own as the page opened (`data-autofocused`) only darken the line until
 * they're left, so the page's first sight isn't a ring.
 */
export const GOAL_PANEL_CLASS =
  "bg-card inset-ring-input has-[textarea[data-autofocused]:focus]:inset-ring-foreground/35 contrast-more:has-[textarea[data-autofocused]:focus]:inset-ring-ring contrast-more:has-[textarea:focus-visible]:ring-ring/50 contrast-more:has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible:not([data-autofocused])]:inset-ring-ring has-[textarea:focus-visible:not([data-autofocused])]:ring-ring/50 rounded-xl inset-ring transition-shadow has-[textarea:focus-visible:not([data-autofocused])]:ring-[3px] motion-reduce:transition-none";

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
 * Takes focus as it shows only with a fine pointer, and not from a control the keyboard is on: on a
 * phone, focus would raise the keyboard.
 */
export function GoalFieldText({
  autoFocusOnPointer = false,
  className,
  onBlur,
  onKeyDown,
  ref,
  ...props
}: Omit<React.ComponentProps<"textarea">, "ref"> & {
  autoFocusOnPointer?: boolean;
  ref?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = ref ?? ownRef;

  const kept = useKeptTyping((typed) => {
    const field = fieldRef.current;

    if (field && field.value !== typed) {
      field.value = typed;
    }
  });

  useEffect(() => {
    const field = fieldRef.current;

    /** A clicked sidebar link can keep pointer focus after navigation; keyboard focus stays put. */
    if (
      field &&
      autoFocusOnPointer &&
      document.activeElement !== field &&
      !document.activeElement?.matches(":focus-visible") &&
      globalThis.matchMedia("(pointer: fine)").matches
    ) {
      field.dataset.autofocused = "";
      field.focus();
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
      onBlur={(event) => {
        onBlur?.(event);
        delete event.currentTarget.dataset.autofocused;
      }}
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
      {...kept.field}
      defaultValue={kept.typed ?? props.defaultValue}
    />
  );
}

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
