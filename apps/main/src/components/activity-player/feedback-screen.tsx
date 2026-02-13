"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { DimensionList, buildDimensionEntries } from "./dimension-inventory";
import { type DimensionInventory, type StepResult } from "./player-reducer";

export function getFeedbackVariant(result: StepResult): "correct" | "incorrect" | "challenge" {
  if (result.effects.length > 0) {
    return "challenge";
  }

  if (result.result.isCorrect) {
    return "correct";
  }

  return "incorrect";
}

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
  const variant = getFeedbackVariant(result);

  if (variant === "challenge") {
    const entries = buildDimensionEntries(dimensions, result.effects);

    return (
      <FeedbackScreen>
        <FeedbackIndicator className="text-foreground">{t("Outcome")}</FeedbackIndicator>

        {result.result.feedback ? (
          <FeedbackMessage>{result.result.feedback}</FeedbackMessage>
        ) : null}

        <DimensionList aria-label="Dimension inventory" entries={entries} variant="feedback" />
      </FeedbackScreen>
    );
  }

  const isCorrect = variant === "correct";

  return (
    <FeedbackScreen>
      <FeedbackIndicator className={isCorrect ? "text-success" : "text-destructive"}>
        {isCorrect ? (
          <CircleCheck aria-hidden="true" className="size-4" />
        ) : (
          <CircleX aria-hidden="true" className="size-4" />
        )}
        <span>{isCorrect ? t("Correct!") : t("Not quite")}</span>
      </FeedbackIndicator>

      {result.result.feedback ? <FeedbackMessage>{result.result.feedback}</FeedbackMessage> : null}
    </FeedbackScreen>
  );
}
