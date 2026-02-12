"use client";

import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StepResult } from "./player-reducer";

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
        "animate-in fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-lg flex-col items-center gap-3 duration-200",
        className,
      )}
      data-slot="feedback-screen"
      role="status"
      {...props}
    />
  );
}

function FeedbackIcon({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("[&_svg]:size-10", className)} data-slot="feedback-icon" {...props} />;
}

function FeedbackTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-xl font-semibold", className)} data-slot="feedback-title" {...props} />
  );
}

function FeedbackMessage({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground max-w-lg text-center text-sm leading-relaxed",
        className,
      )}
      data-slot="feedback-message"
      {...props}
    />
  );
}

function FeedbackEffects({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("border-border mx-auto max-w-xs border-t pt-6", className)}
      data-slot="feedback-effects"
      {...props}
    />
  );
}

function getEffectColor(impact: ChallengeEffect["impact"]): string {
  if (impact === "positive") {
    return "text-success";
  }

  if (impact === "negative") {
    return "text-destructive";
  }

  return "text-muted-foreground";
}

function getEffectLabel(impact: ChallengeEffect["impact"]): string {
  if (impact === "positive") {
    return "+1";
  }

  if (impact === "negative") {
    return "-1";
  }

  return "0";
}

function FeedbackEffect({
  effect,
  className,
  ...props
}: React.ComponentProps<"li"> & { effect: ChallengeEffect }) {
  return (
    <li
      className={cn("flex items-center justify-between py-1", className)}
      data-slot="feedback-effect"
      {...props}
    >
      <span className="text-muted-foreground text-sm">{effect.dimension}</span>
      <span className={cn("text-sm font-medium", getEffectColor(effect.impact))}>
        {getEffectLabel(effect.impact)}
      </span>
    </li>
  );
}

export function FeedbackScreenContent({ result }: { result: StepResult }) {
  const t = useExtracted();
  const variant = getFeedbackVariant(result);

  if (variant === "challenge") {
    return (
      <FeedbackScreen>
        <FeedbackTitle className="text-foreground">{t("Outcome")}</FeedbackTitle>

        {result.result.feedback ? (
          <FeedbackMessage>{result.result.feedback}</FeedbackMessage>
        ) : null}

        {result.effects.length > 0 ? (
          <FeedbackEffects>
            {result.effects.map((effect) => (
              <FeedbackEffect effect={effect} key={effect.dimension} />
            ))}
          </FeedbackEffects>
        ) : null}
      </FeedbackScreen>
    );
  }

  const isCorrect = variant === "correct";

  return (
    <FeedbackScreen>
      <FeedbackIcon>
        {isCorrect ? (
          <CircleCheck aria-label={t("Correct!")} className="text-success" />
        ) : (
          <CircleX aria-label={t("Not quite")} className="text-destructive" />
        )}
      </FeedbackIcon>

      <FeedbackTitle className={isCorrect ? "text-success" : "text-destructive"}>
        {isCorrect ? t("Correct!") : t("Not quite")}
      </FeedbackTitle>

      {result.result.feedback ? <FeedbackMessage>{result.result.feedback}</FeedbackMessage> : null}
    </FeedbackScreen>
  );
}
