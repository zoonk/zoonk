import { spawn } from "node:child_process";

const INTERRUPT_EXIT_CODE = 130;
const TERMINATION_EXIT_CODE = 143;

export type CommandResult = { code: number | null; signal: NodeJS.Signals | null };
export type ExecutableCommand = { args: string[]; command: string };

/** Through the current Node runtime, so Windows `.cmd` shims aren't needed inside pnpm scripts. */
export function getPnpmCommand(environment: NodeJS.ProcessEnv): ExecutableCommand {
  const pnpmExecutable = environment.npm_execpath;

  if (!pnpmExecutable) {
    return { args: [], command: "pnpm" };
  }

  if (/\.[cm]?js$/iu.test(pnpmExecutable)) {
    return { args: [pnpmExecutable], command: process.execPath };
  }

  return { args: [], command: pnpmExecutable };
}

export function runForegroundCommand({
  args,
  command,
  currentDirectory,
  environment,
}: {
  args: string[];
  command: string;
  currentDirectory: string;
  environment: NodeJS.ProcessEnv;
}): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: currentDirectory,
      env: environment,
      stdio: "inherit",
    });

    function forwardSignal(signal: NodeJS.Signals): void {
      if (child.exitCode === null && !child.killed) {
        child.kill(signal);
      }
    }

    function forwardInterrupt(): void {
      forwardSignal("SIGINT");
    }

    function forwardTermination(): void {
      forwardSignal("SIGTERM");
    }

    function removeSignalHandlers(): void {
      process.off("SIGINT", forwardInterrupt);
      process.off("SIGTERM", forwardTermination);
    }

    process.on("SIGINT", forwardInterrupt);
    process.on("SIGTERM", forwardTermination);

    child.on("error", (error) => {
      removeSignalHandlers();
      reject(error);
    });

    child.on("exit", (code, signal) => {
      removeSignalHandlers();
      resolve({ code, signal });
    });
  });
}

export function applyCommandExit({ code, signal }: CommandResult): void {
  if (signal) {
    process.exitCode = signal === "SIGINT" ? INTERRUPT_EXIT_CODE : TERMINATION_EXIT_CODE;
    return;
  }

  process.exitCode = code ?? 1;
}
