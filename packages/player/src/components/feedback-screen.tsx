"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type DimensionInventory, type StepResult } from "../player-reducer";
import { useReplaceName } from "../user-name-context";
import { DimensionList, buildDimensionEntries } from "./dimension-inventory";

function FeedbackScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-lg flex-col gap-6 duration-200 ease-out motion-reduce:animate-none",
        className,
      )}
      data-slot="feedback-screen"
      role="status"
      {...props}
    />
  );
}

function FeedbackIndicator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-1.5 text-sm font-medium", className)}
      data-slot="feedback-indicator"
      {...props}
    />
  );
}

function FeedbackMessage({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-foreground max-w-md text-lg leading-relaxed", className)}
      data-slot="feedback-message"
      {...props}
    />
  );
}

export function FeedbackScreenContent({
  dimensions,
  result,
}: {
  dimensions: DimensionInventory;
  result: StepResult;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const feedback = result.result.feedback ? replaceName(result.result.feedback) : null;
  const entries = buildDimensionEntries(dimensions, result.effects);

  return (
    <FeedbackScreen>
      <FeedbackIndicator className="text-foreground">{t("Outcome")}</FeedbackIndicator>

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      <DimensionList aria-label={t("Dimension inventory")} entries={entries} variant="feedback" />
    </FeedbackScreen>
  );
}
