import { formatConsoleArgs } from "@zoonk/core/library/activities/console-values";
import {
  MAX_PROGRAM_OUTPUT_LENGTH,
  capProgramText,
} from "@zoonk/core/library/activities/program-limits";
import { parsePythonError } from "@zoonk/core/library/activities/python-error";
import { type SandboxMessage, runInSandbox } from "./sandbox-host";

type ProgramLanguage = "javascript" | "python";

type ProgramStop = "done" | "error" | "timeout" | "tooMuchOutput" | "unavailable";

export type ProgramRun = {
  error: { line: number | null; message: string } | null;
  errorOutput: string;
  output: string;
  stop: ProgramStop;
};

function messageText(message: SandboxMessage): string {
  if (message.type === "log") {
    return `${formatConsoleArgs(message.args)}\n`;
  }

  return message.type === "output" ? message.text : "";
}

export async function runProgram({
  code,
  language,
}: {
  code: string;
  language: ProgramLanguage;
}): Promise<ProgramRun> {
  const streams = { stderr: "", stdout: "" };
  const flags = { flooded: false };

  const outcome = await runInSandbox({
    kind: language,
    onMessage: (message) => {
      if (message.type !== "log" && message.type !== "output") {
        return true;
      }

      streams[message.stream] += messageText(message);
      flags.flooded = streams.stdout.length + streams.stderr.length > MAX_PROGRAM_OUTPUT_LENGTH;
      return !flags.flooded;
    },
    payload: { code },
  });

  const base = {
    errorOutput: capProgramText(streams.stderr),
    output: capProgramText(streams.stdout),
  };

  if (outcome.status === "error") {
    const error =
      language === "python"
        ? parsePythonError(outcome.message)
        : { line: outcome.line, message: outcome.message };

    return { ...base, error: { ...error, message: capProgramText(error.message) }, stop: "error" };
  }

  if (outcome.status === "done") {
    return { ...base, error: null, stop: flags.flooded ? "tooMuchOutput" : "done" };
  }

  return { ...base, error: null, stop: outcome.status };
}
