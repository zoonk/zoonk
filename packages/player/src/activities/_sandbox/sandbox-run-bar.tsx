"use client";

import { Button } from "@zoonk/ui/components/button";
import { LoaderCircle, Play, RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { type SandboxRuntimeStatus } from "./use-sandbox-runtime";

export function SandboxRunBar({
  hasRun,
  isRunning,
  onReset,
  onRetry,
  onRun,
  runtimeName,
  runtimeStatus,
}: {
  hasRun: boolean;
  isRunning: boolean;
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {onReset && (
          <Button
            aria-label={t("Start over with the original code")}
            disabled={isRunning}
            onClick={onReset}
            size="icon-lg"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        )}

        <Button
          className="flex-1"
          disabled={isRunning}
          onClick={onRun}
          size="lg"
          variant={hasRun ? "outline" : "default"}
        >
          {isRunning ? (
            <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {isRunning && t("Running")}
          {!isRunning && (hasRun ? t("Run again") : t("Run"))}
        </Button>
      </div>

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
