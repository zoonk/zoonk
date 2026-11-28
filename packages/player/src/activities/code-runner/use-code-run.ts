"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import {
  type ProgramLanguage,
  isSandboxLanguage,
} from "@zoonk/core/library/activities/program-languages";
import { type CodeRunPhase } from "@zoonk/core/library/activities/sandbox-contract";
import { type HelpLimit, useLiveLimit } from "@zoonk/learn/help-limit";
import { useRef, useState } from "react";
import { useLessonPlayerConfig } from "../../lesson/lesson-player-context";
import { type CodeRunOutcome } from "../../lesson/lesson-player-types";
import { runOnServer } from "../_sandbox/run-on-server";
import { type ProgramRun, runProgram } from "../_sandbox/run-program";
import { type ServerRunProblem } from "../_sandbox/sandbox-run-bar";
import { useEditorRun } from "../_sandbox/use-editor-run";
import { useSandboxRuntime } from "../_sandbox/use-sandbox-runtime";

/** A run on this device, or the outcome of one on our servers, which carries its `runId`. */
type RunOutcome =
  | { result: ProgramRun & { runId?: string }; status: "finished" }
  | Exclude<CodeRunOutcome, { status: "alreadyRunning" | "finished" }>;

function runFromAnswer(answer: ActivityAnswer | null): ProgramRun | null {
  return answer?.kind === "output"
    ? { error: null, errorOutput: "", output: answer.output, stop: "done" }
    : null;
}

/**
 * Runs the learner's program on this device, or on our servers for a language that needs them.
 * There, `phase` is what the run is doing, `problem` why it didn't come back, and `limit` a refused
 * run; a run that broke off is sent again under its request, so the server answers it once.
 */
export function useCodeRun({
  answer,
  isChecked,
  language,
  onAnswerChange,
}: {
  answer: ActivityAnswer | null;
  isChecked: boolean;
  language: ProgramLanguage;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
}) {
  const { adapters } = useLessonPlayerConfig();
  const runsOnServer = isSandboxLanguage(language);
  const runtime = useSandboxRuntime(runsOnServer ? null : language);
  const [run, setRun] = useState<ProgramRun | null>(() => runFromAnswer(answer));
  const [phase, setPhase] = useState<CodeRunPhase>("starting");
  const [problem, setProblem] = useState<ServerRunProblem | null>(null);
  const [refusal, setRefusal] = useState<HelpLimit | null>(null);
  const limit = useLiveLimit(refusal);
  const retry = useRef<{ code: string; requestId: string } | null>(null);
  const editorRun = useEditorRun({ isChecked });

  async function runProgramOnce(code: string, revision: number): Promise<RunOutcome> {
    if (!isSandboxLanguage(language)) {
      return { result: await runProgram({ code, language }), status: "finished" };
    }

    const requestId = retry.current?.code === code ? retry.current.requestId : crypto.randomUUID();

    const outcome = await runOnServer({
      code,
      keepWaiting: () => editorRun.isActive(revision),
      language,
      onPhase: setPhase,
      requestId,
      runCode: adapters.runCode,
    });

    retry.current = outcome.status === "offline" ? { code, requestId } : null;
    return outcome;
  }

  async function start(code: string) {
    const revision = isChecked ? null : editorRun.start();

    if (revision === null) {
      return;
    }

    setPhase("starting");
    setProblem(null);
    setRefusal(null);

    const outcome = await runProgramOnce(code, revision);
    const status = editorRun.finish(revision);

    if (status === "cancelled") {
      return;
    }

    if (outcome.status === "offline" || outcome.status === "unavailable") {
      setProblem(outcome.status);
      return;
    }

    if (outcome.status !== "finished") {
      setRefusal(outcome);
      return;
    }

    const { result } = outcome;
    setRun(result);

    onAnswerChange(
      status !== "current" || result.stop === "unavailable"
        ? null
        : { kind: "output", output: result.output, ...(result.runId && { runId: result.runId }) },
    );
  }

  return {
    edit: editorRun.edit,
    isRunning: editorRun.isRunning,
    isStale: editorRun.isStale,
    limit,
    phase: runsOnServer ? phase : undefined,
    problem,
    retryRuntime: runtime.retry,
    run,
    runsOnServer,
    runtimeStatus: runtime.status,
    start,
  };
}
