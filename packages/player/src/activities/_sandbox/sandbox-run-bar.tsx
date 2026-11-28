"use client";

import { type CodeRunPhase } from "@zoonk/core/library/activities/sandbox-contract";
import { Button } from "@zoonk/ui/components/button";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { Play, RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { type SandboxRuntimeStatus } from "./use-sandbox-runtime";

/** A warm run answers sooner, so its phases never flash. */
const PHASE_AFTER_MS = 400;

/** Why a run on our servers didn't come back: the connection, or the server. */
export type ServerRunProblem = "offline" | "unavailable";

function useProblemText({
  problem,
  runtimeName,
  runtimeStatus,
}: {
  problem: ServerRunProblem | null;
  runtimeName: string;
  runtimeStatus: SandboxRuntimeStatus;
}): string | null {
  const t = useExtracted();

  if (problem === "offline") {
    return t("Running {runtime} code needs a connection. Check yours and try again.", {
      runtime: runtimeName,
    });
  }

  if (problem === "unavailable") {
    return t("Your code didn't run. Try again.");
  }

  return runtimeStatus === "failed"
    ? t("{runtime} didn't load. Check your connection and try again.", { runtime: runtimeName })
    : null;
}

function usePhaseText({
  phase,
  runtimeName,
}: {
  phase: CodeRunPhase;
  runtimeName: string;
}): string {
  const t = useExtracted();

  switch (phase) {
    case "starting":
      return t("Getting {runtime} ready…", { runtime: runtimeName });
    case "compiling":
      return t("Compiling your code…");
    case "running":
      return t("Running your code…");
    default:
      return phase satisfies never;
  }
}

function StatusLine({ children }: { children: string }) {
  return (
    <p aria-live="polite" className="text-muted-foreground text-xs">
      {children}
    </p>
  );
}

function PhaseLine({
  isRunning,
  phase,
  runtimeName,
}: {
  isRunning: boolean;
  phase: CodeRunPhase;
  runtimeName: string;
}) {
  const isSlow = useTakingLong({ active: isRunning, afterMs: PHASE_AFTER_MS });
  const text = usePhaseText({ phase, runtimeName });

  return isSlow ? <StatusLine>{text}</StatusLine> : null;
}

/**
 * `phase` is set for a language our servers run: what the run is doing, shown once it takes a
 * moment. `problem` says why the last of those runs didn't come back, in place of Run.
 */
export function SandboxRunBar({
  canRun = true,
  hasRun,
  isRunning,
  isExploring,
  onReset,
  onRetry,
  onRun,
  phase,
  problem = null,
  runtimeName,
  runtimeStatus,
}: {
  canRun?: boolean;
  hasRun: boolean;
  isRunning: boolean;
  isExploring: boolean;
  onReset?: () => void;
  onRetry: () => void;
  onRun: () => void;
  phase?: CodeRunPhase;
  problem?: ServerRunProblem | null;
  runtimeName: string;
  runtimeStatus: SandboxRuntimeStatus;
}) {
  const t = useExtracted();
  const problemText = useProblemText({ problem, runtimeName, runtimeStatus });

  if (problemText) {
    return (
      <div className="flex flex-col gap-2" role="alert">
        <p className="text-destructive-text text-sm">{problemText}</p>
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

        <Button
          busy={isRunning}
          disabled={!canRun || isRunning}
          icon={<Play aria-hidden="true" />}
          onClick={onRun}
          size="lg"
          variant="outline"
        >
          {isExploring && hasRun ? t("Run again") : t("Run")}
        </Button>
      </div>

      {runtimeStatus === "loading" && (
        <StatusLine>
          {t("Getting {runtime} ready. This takes a few seconds the first time.", {
            runtime: runtimeName,
          })}
        </StatusLine>
      )}

      {phase && <PhaseLine isRunning={isRunning} phase={phase} runtimeName={runtimeName} />}
    </div>
  );
}
