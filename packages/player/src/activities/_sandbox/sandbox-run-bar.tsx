"use client";

import { Button } from "@zoonk/ui/components/button";
import { Play, RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { ActivityBarAction } from "../_components/activity-bar-action";
import { type SandboxRuntimeStatus } from "./use-sandbox-runtime";

/**
 * Running a learner's code. On a question the run is the bar's main action until its result is
 * there to check (`needsRun`); on a screen that only explores, Continue is the bar's, so the run
 * stays a quiet button in the card.
 */
export function SandboxRunBar({
  canRun = true,
  hasRun,
  isRunning,
  needsRun,
  onReset,
  onRetry,
  onRun,
  runtimeName,
  runtimeStatus,
}: {
  canRun?: boolean;
  hasRun: boolean;
  isRunning: boolean;
  /** `null` on a screen that asks for no answer. */
  needsRun: boolean | null;
  onReset?: () => void;
  onRetry: () => void;
  onRun: () => void;
  runtimeName: string;
  runtimeStatus: SandboxRuntimeStatus;
}) {
  const t = useExtracted();

  if (runtimeStatus === "failed") {
    return (
      <div className="flex flex-col gap-2" role="alert">
        <p className="text-destructive-text text-sm">
          {t("{runtime} didn't load. Check your connection and try again.", {
            runtime: runtimeName,
          })}
        </p>
        <Button className="self-start" onClick={onRetry} variant="outline">
          <RotateCcw aria-hidden="true" />
          {t("Try again")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 empty:hidden">
      {needsRun && (
        <ActivityBarAction busy={isRunning} disabled={!canRun} onPress={onRun}>
          {t("Run")}
        </ActivityBarAction>
      )}

      {(onReset || needsRun === null) && (
        <div className="flex items-center gap-2">
          {onReset && (
            <Button
              disabled={isRunning}
              focusableWhenDisabled
              icon={<RotateCcw aria-hidden="true" />}
              onClick={onReset}
              size="lg"
              variant="outline"
            >
              {t("Start over")}
            </Button>
          )}

          {needsRun === null && (
            <Button
              busy={isRunning}
              className="flex-1"
              icon={<Play aria-hidden="true" />}
              onClick={onRun}
              size="lg"
              variant="outline"
            >
              {hasRun ? t("Run again") : t("Run")}
            </Button>
          )}
        </div>
      )}

      {runtimeStatus === "loading" && (
        <p aria-live="polite" className="text-muted-foreground text-xs">
          {t("Getting {runtime} ready. This takes a few seconds the first time.", {
            runtime: runtimeName,
          })}
        </p>
      )}
    </div>
  );
}
