"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCcwIcon, SquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { CreateAccountLink } from "../_components/create-account-link";
import { type HelpLimit, needsAccount, useHelpLimitWords } from "../_components/help-limit-notice";
import { useSentenceSpace } from "../_utils/locale";
import { type SpokenAudioState } from "./use-spoken-audio";

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

export function withoutFailure(state: SpokenAudioState): SpokenAudioState {
  return state.status === "failed" ? { status: "idle" } : state;
}

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

function LimitTitle({ limit }: { limit: HelpLimit }) {
  const { line, title } = useHelpLimitWords(limit);
  return <p className="font-medium text-pretty">{title ?? line}</p>;
}

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
  const canRetry = !limit || limit.status === "slowDown";
  const space = useSentenceSpace();

  return (
    <div className={cn("flex flex-col items-start gap-2 text-sm", className)} role="status">
      {limit && <LimitTitle limit={limit} />}

      {(text || !limit) && (
        <p className="text-muted-foreground text-pretty">
          {!limit && t("The audio didn't play.")}
          {!limit && space}
          {text && t("Here's what it says:")}
        </p>
      )}

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

      {limit && needsAccount(limit) && <CreateAccountLink />}
    </div>
  );
}
