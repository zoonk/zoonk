"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type PointerEvent } from "react";
import { usePlayerRuntime } from "../player-context";
import { renderPlayerShortcutHintKey, showPlayerShortcutHint } from "../player-shortcut-hint";

/**
 * Single source of truth for the step action button
 * (Check, Continue).
 *
 * Handles every non-navigation action for answer and feedback steps.
 *
 * Rendered in two places with different visibility:
 * - Inside the PlayerBottomBar for mobile (visible below lg)
 * - Inline on desktop, either below the step or inside a media choice column
 *
 * This avoids duplicating button logic across the bottom bar
 * and the desktop action slots.
 */
export function StepActionButton({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children" | "onClick" | "onPointerUp" | "size">) {
  const t = useExtracted();
  const { actions, screen } = usePlayerRuntime();
  const model = screen.bottomBar;

  if (!model || model.kind === "navigation") {
    return null;
  }

  const { button, disabled, run } = model;
  const actionByRun = { check: actions.check, continue: actions.continue } as const;

  const labelByButton = { check: t("Check"), continue: t("Continue") } as const;

  /**
   * Enter submits a pending selection, but Continue is a separate progression
   * action. Limiting the tip to Check keeps this coachmark aligned with the
   * exact shortcut discovery moment the learner just missed.
   */
  function handleActionPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (run === "check") {
      showPlayerShortcutHint({
        event,
        hint: "checkAnswer",
        message: t.rich("Keyboard shortcut: press <kbd>Enter</kbd> to check your answer.", {
          kbd: renderPlayerShortcutHintKey,
        }),
      });
    }
  }

  const buttonProps = {
    ...props,
    "aria-keyshortcuts": "Enter",
    className: cn("w-full", className),
    disabled,
    onClick: actionByRun[run],
    onPointerUp: handleActionPointerUp,
    size: "lg" as const,
  };

  return (
    <Button {...buttonProps}>
      {labelByButton[button]}
      <ShortcutKbd tone="inverse">Enter</ShortcutKbd>
    </Button>
  );
}
