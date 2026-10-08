"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCcwIcon, SquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { type HelpLimit, useHelpLimitMessage } from "../_components/help-limit-notice";
import { type SpokenAudioState } from "./use-spoken-audio";

/**
 * A play button's icon for its sound's state: the button's own icon at rest, a spinner while the
 * clip is on its way, stop while it plays and try again after it failed.
 */
export function SpeechStatusIcon({
  className,
  idle,
  state,
}: {
  className?: string;
  idle: ReactNode;
  state: SpokenAudioState;
}) {
  if (state.status === "loading") {
    return <Spinner aria-hidden="true" className={cn("size-5", className)} />;
  }

  if (state.status === "playing") {
    return <SquareIcon aria-hidden="true" className={cn("fill-current", className)} />;
  }

  if (state.status === "failed") {
    return <RotateCcwIcon aria-hidden="true" className={className} />;
  }

  return idle;
}

/**
 * The state a screen's main play button shows when the screen explains a failure itself
 * (`SpeechFailedNote`, with its own Try again): the button goes back to playing, not retrying.
 */
export function withoutFailure(state: SpokenAudioState): SpokenAudioState {
  return state.status === "failed" ? { status: "idle" } : state;
}

/** A play button's accessible name for its sound's state; `idle` is what it plays. */
export function useSpeechActionLabel(state: SpokenAudioState, idle: string): string {
  const t = useExtracted();

  if (state.status === "loading") {
    return t("Getting the audio ready…");
  }

  if (state.status === "playing") {
    return t("Stop the audio");
  }

  return state.status === "failed" ? t("Try the audio again") : idle;
}

function LimitMessage({ limit }: { limit: HelpLimit }) {
  return <>{useHelpLimitMessage(limit)}</>;
}

/**
 * What a learner sees when a sound didn't come: why, a way to try again unless a cap stands in
 * the way, and, when the screen gives it, the words the sound says, so they can keep going.
 */
export function SpeechFailedNote({
  className,
  language,
  limit,
  onRetry,
  text,
}: {
  className?: string;
  language: string;
  limit: HelpLimit | null;
  onRetry: () => void;
  text?: string;
}) {
  const t = useExtracted();
  const canRetry = limit?.status !== "limitReached";

  return (
    <div className={cn("flex flex-col items-start gap-2 text-sm", className)} role="status">
      <p className="text-muted-foreground text-pretty">
        {limit ? <LimitMessage limit={limit} /> : t("The audio didn't play.")}{" "}
        {text && t("Here's what it says:")}
      </p>

      {text && (
        <p className="text-foreground text-base text-pretty" lang={language}>
          {text}
        </p>
      )}

      {canRetry && (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          <RotateCcwIcon aria-hidden="true" />
          {t("Try again")}
        </Button>
      )}
    </div>
  );
}
