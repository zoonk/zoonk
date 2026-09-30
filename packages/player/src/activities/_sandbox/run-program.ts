import { formatConsoleArgs } from "@zoonk/core/library/activities/console-values";
import { MAX_PROGRAM_OUTPUT_LENGTH } from "@zoonk/core/library/activities/program-limits";
import { parsePythonError } from "@zoonk/core/library/activities/python-error";
import { type SandboxMessage, runInSandbox } from "./sandbox-host";

type ProgramLanguage = "javascript" | "python";

/** Why a run ended: normally, with an error, out of time, flooding output, or no runtime. */
type ProgramStop = "done" | "error" | "timeout" | "tooMuchOutput" | "unavailable";

export type ProgramRun = {
  error: { line: number | null; message: string } | null;
  /** What the program wrote to stderr, like `console.error` or warnings. */
  errorOutput: string;
  /** What the program printed: the output the check compares. */
  output: string;
  stop: ProgramStop;
};

function messageText(message: SandboxMessage): string {
  if (message.type === "log") {
    return `${formatConsoleArgs(message.args)}\n`;
  }

  return message.type === "output" ? message.text : "";
}

/**
 * Runs a learner's program in the browser sandbox and collects what it printed. Output is kept
 * even when the program fails or runs out of time, so the learner sees how far it got.
 */
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
    errorOutput: streams.stderr,
    output: streams.stdout.slice(0, MAX_PROGRAM_OUTPUT_LENGTH),
  };

  if (outcome.status === "error") {
    const error =
      language === "python"
        ? parsePythonError(outcome.message)
        : { line: outcome.line, message: outcome.message };

    return { ...base, error, stop: "error" };
  }

  if (outcome.status === "done") {
    return { ...base, error: null, stop: flags.flooded ? "tooMuchOutput" : "done" };
  }

  return { ...base, error: null, stop: outcome.status };
}
