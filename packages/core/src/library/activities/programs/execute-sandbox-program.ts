import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { PROGRAM_LANGUAGES, type SandboxLanguage } from "./program-languages";
import { MAX_PROGRAM_OUTPUT_LENGTH } from "./program-limits";
import { type CodeRunPhase, type CodeRunResult } from "./sandbox-contract";
import { type ProgramSandbox } from "./sandbox-driver";
import { SANDBOX_RUN_SECONDS, SANDBOX_TOOLCHAINS, compileSeconds } from "./sandbox-languages";
import { SANDBOX_STAGING_DIR, SANDBOX_WRAPPER_PATH } from "./sandbox-wrapper";

type Phase = (phase: CodeRunPhase) => void;
type CommandPhase = "compile" | "run";
type Stage = { exitCode: number; stderr: string; stdout: string };

// Bound the VM writes while leaving room for UTF-8 sequences at the character limit.
const MAX_UTF8_BYTES_PER_CHARACTER = 4;
const STREAM_CAP_BYTES = MAX_PROGRAM_OUTPUT_LENGTH * MAX_UTF8_BYTES_PER_CHARACTER + 1;
const WRAPPER_FAILED = 125;
const SIGNAL_KILLED = 137;

export function sandboxRunError(language: SandboxLanguage, errorOutput: string) {
  const line =
    Number(SANDBOX_TOOLCHAINS[language].errorLine.exec(errorOutput)?.groups?.line) || null;

  return { line, message: errorOutput.trim() || "The program stopped with an error" };
}

async function runStage({
  argv,
  phase,
  runId,
  sandbox,
  seconds,
}: {
  argv: readonly string[];
  phase: CommandPhase;
  runId: string;
  sandbox: ProgramSandbox;
  seconds: number;
}): Promise<Stage> {
  const exitCode = await sandbox.run({
    args: [phase, runId, String(seconds), String(STREAM_CAP_BYTES), ...argv],
    cmd: SANDBOX_WRAPPER_PATH,
    sudo: true,
  });

  if (exitCode === WRAPPER_FAILED) {
    throw new Error("Program sandbox wrapper could not run or clean up");
  }

  const prefix = `${SANDBOX_STAGING_DIR}/${runId}/${phase}`;

  const [stdout, stderr] = await Promise.all([
    sandbox.read(`${prefix}.stdout`),
    sandbox.read(`${prefix}.stderr`),
  ]);

  return { exitCode, stderr, stdout };
}

function stopOf({
  errorOutput,
  output,
  exitCode,
}: {
  errorOutput: string;
  output: string;
  exitCode: number;
}): Exclude<CodeRunResult["stop"], "unavailable"> {
  if (output.length + errorOutput.length > MAX_PROGRAM_OUTPUT_LENGTH) {
    return "tooMuchOutput";
  }

  if (exitCode === SIGNAL_KILLED) {
    return "timeout";
  }

  return exitCode === 0 ? "done" : "error";
}

function resultOf({
  compile,
  run,
  runId,
  language,
}: {
  compile: Stage | null;
  run: Stage | null;
  runId: string;
  language: SandboxLanguage;
}): CodeRunResult {
  const output = run?.stdout ?? "";
  const errors = (compile?.stdout ?? "") + (compile?.stderr ?? "") + (run?.stderr ?? "");

  const stop = stopOf({
    errorOutput: errors,
    exitCode: run?.exitCode ?? compile?.exitCode ?? 0,
    output,
  });

  const cappedOutput = output.slice(0, MAX_PROGRAM_OUTPUT_LENGTH).toWellFormed();

  const errorOutput = errors
    .slice(0, MAX_PROGRAM_OUTPUT_LENGTH - cappedOutput.length)
    .toWellFormed();

  return {
    error: stop === "error" ? sandboxRunError(language, errorOutput) : null,
    errorOutput,
    output: cappedOutput,
    runId,
    stop,
  };
}

function sandboxCommand(sandbox: ProgramSandbox, args: string[]) {
  return sandbox.run({ args, cmd: SANDBOX_WRAPPER_PATH, sudo: true });
}

export async function executeSandboxProgram({
  code,
  language,
  onPhase,
  runId,
  sandbox,
}: {
  code: string;
  language: SandboxLanguage;
  onPhase?: Phase;
  runId: string;
  sandbox: ProgramSandbox;
}): Promise<CodeRunResult> {
  const { fileName } = PROGRAM_LANGUAGES[language];
  const toolchain = SANDBOX_TOOLCHAINS[language];
  const files = Object.entries({ ...toolchain.files, [fileName]: code });

  const executed = await safeAsync(async () => {
    await sandbox.write(
      files.map(([name, content]) => ({
        content,
        path: `${SANDBOX_STAGING_DIR}/${runId}/${name}`,
      })),
    );

    if ((await sandboxCommand(sandbox, ["prepare", runId, ...files.map(([name]) => name)])) !== 0) {
      throw new Error("Program sandbox could not prepare the working directory");
    }

    if (toolchain.compile) {
      onPhase?.("compiling");
    }

    const compile = toolchain.compile
      ? await runStage({
          argv: toolchain.compile,
          phase: "compile",
          runId,
          sandbox,
          seconds: compileSeconds(language),
        })
      : null;

    if (
      compile &&
      stopOf({
        errorOutput: compile.stdout + compile.stderr,
        exitCode: compile.exitCode,
        output: "",
      }) !== "done"
    ) {
      return resultOf({ compile, language, run: null, runId });
    }

    onPhase?.("running");

    const run = await runStage({
      argv: toolchain.run,
      phase: "run",
      runId,
      sandbox,
      seconds: SANDBOX_RUN_SECONDS,
    });

    return resultOf({ compile, language, run, runId });
  });

  const cleaned = await safeAsync(() => sandboxCommand(sandbox, ["clean", runId]));

  if (executed.error) {
    throw executed.error;
  }

  if (cleaned.data !== 0) {
    throw new Error("Program sandbox could not remove the working directory", {
      cause: cleaned.error,
    });
  }

  return executed.data;
}
