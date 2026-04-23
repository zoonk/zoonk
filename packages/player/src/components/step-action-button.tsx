"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePlayerRuntime } from "../player-context";

/**
 * Single source of truth for the step action button
 * (Begin, Check, Continue, Start Investigation).
 *
 * Handles every non-navigation action: story intro/outcome,
 * investigation problem, and regular interactive steps.
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
}: Omit<React.ComponentProps<typeof Button>, "children" | "onClick" | "size">) {
  const t = useExtracted();
  const { actions, screen } = usePlayerRuntime();
  const model = screen.bottomBar;

  if (!model || model.kind === "navigation") {
    return null;
  }

  const actionByRun = {
    check: actions.check,
    continue: actions.continue,
    navigateNext: actions.navigateNext,
  } as const;

  const labelByButton = {
    begin: t("Begin"),
    check: t("Check"),
    continue: t("Continue"),
    startInvestigation: t("Start Investigation"),
  } as const;

  const buttonProps = {
    ...props,
    className: cn("w-full", className),
    disabled: model.disabled,
    onClick: actionByRun[model.run],
    size: "lg" as const,
  };

  return <Button {...buttonProps}>{labelByButton[model.button]}</Button>;
}
