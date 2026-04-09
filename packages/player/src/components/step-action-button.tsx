"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePlayerRuntime } from "../player-context";
import {
  getHasAnswer,
  getIsInvestigationProblem,
  getStoryStaticVariant,
} from "../player-selectors";

/**
 * Single source of truth for the step action button
 * (Begin, Check, Continue, Start Investigation).
 *
 * Handles every non-navigation action: story intro/outcome,
 * investigation problem, and regular interactive steps.
 *
 * Rendered in two places with different visibility:
 * - Inside the PlayerBottomBar for mobile (visible below lg)
 * - Inline below step content for desktop (visible at lg+)
 *
 * This avoids duplicating button logic across the bottom bar
 * and the desktop inline slot.
 */
export function StepActionButton({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children" | "onClick" | "size">) {
  const t = useExtracted();
  const { actions, state } = usePlayerRuntime();

  const hasAnswer = getHasAnswer(state);
  const isInvestigationProblem = getIsInvestigationProblem(state);
  const storyStaticVariant = getStoryStaticVariant(state);

  if (storyStaticVariant === "storyIntro") {
    return (
      <Button
        className={cn("w-full", className)}
        onClick={actions.navigateNext}
        size="lg"
        {...props}
      >
        {t("Begin")}
      </Button>
    );
  }

  if (storyStaticVariant === "storyOutcome") {
    return (
      <Button
        className={cn("w-full", className)}
        onClick={actions.navigateNext}
        size="lg"
        {...props}
      >
        {t("Continue")}
      </Button>
    );
  }

  if (isInvestigationProblem) {
    return (
      <Button className={cn("w-full", className)} onClick={actions.check} size="lg" {...props}>
        {t("Start Investigation")}
      </Button>
    );
  }

  return (
    <Button
      className={cn("w-full", className)}
      disabled={state.phase === "playing" && !hasAnswer}
      onClick={state.phase === "feedback" ? actions.continue : actions.check}
      size="lg"
      {...props}
    >
      {state.phase === "feedback" ? t("Continue") : t("Check")}
    </Button>
  );
}
