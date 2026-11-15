"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/** A key's own name, the same on every keyboard, so it isn't translated. */
const SHIFT_KEY = "Shift";
const ENTER_KEY = "⏎";

/**
 * What Enter and Shift+Enter do in a box that takes both, as keycaps, where there is a keyboard.
 * The lesson's answer box and the buddy's composer say it with this one piece; a screen reader
 * gets the sentence.
 */
export function EnterHint({
  action,
  className,
  id,
}: {
  action: "check" | "send";
  className?: string;
  id?: string;
}) {
  const t = useExtracted();

  return (
    <p
      aria-live="polite"
      className={cn("text-muted-foreground hidden text-xs pointer-fine:block", className)}
      data-slot="enter-hint"
      id={id}
    >
      <span aria-hidden="true" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Kbd>{ENTER_KEY}</Kbd>
          {action === "check"
            ? t({
                description:
                  "Keyboard hint under an answer box, right after a picture of the Enter key: pressing Enter checks the answer. Lowercase, one word if possible.",
                message: "check",
              })
            : t({
                description:
                  "Keyboard hint under a message box, right after a picture of the Enter key: pressing Enter sends the message. Lowercase, one word if possible.",
                message: "send",
              })}
        </span>

        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            <Kbd>{SHIFT_KEY}</Kbd>
            <Kbd>{ENTER_KEY}</Kbd>
          </span>
          {t({
            description:
              "Keyboard hint under a text box, right after pictures of the Shift and Enter keys: pressing them together starts a new line. Lowercase.",
            message: "new line",
          })}
        </span>
      </span>

      <span className="sr-only">
        {action === "check"
          ? t("Press Enter to check, Shift+Enter for a new line.")
          : t("Press Enter to send, Shift+Enter for a new line.")}
      </span>
    </p>
  );
}
