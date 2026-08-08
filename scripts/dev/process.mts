import { spawn } from "node:child_process";

const INTERRUPT_EXIT_CODE = 130;
const TERMINATION_EXIT_CODE = 143;

export type CommandResult = { code: number | null; signal: NodeJS.Signals | null };
export type ExecutableCommand = { args: string[]; command: string };

/** Invokes pnpm through the current Node runtime so Windows `.cmd` shims are not required inside pnpm lifecycle scripts. */
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

/**
 * Keeps one interactive child attached to the current terminal and forwards explicit shutdowns to it. Turbo and Portless remain responsible for their own child processes.
 */
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

    /** Gives the child the same explicit stop received by this lightweight wrapper. */
    function forwardSignal(signal: NodeJS.Signals): void {
      if (child.exitCode === null && !child.killed) {
        child.kill(signal);
      }
    }

    /** Forwards an interactive stop using the signal expected by terminal applications. */
    function forwardInterrupt(): void {
      forwardSignal("SIGINT");
    }

    /** Forwards task-runner shutdowns so nested framework processes can release their locks. */
    function forwardTermination(): void {
      forwardSignal("SIGTERM");
    }

    /** Removes process-level listeners after the one child owned by this wrapper exits. */
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

/** Preserves a failed child status so shell scripts and agents can detect that the development command did not start cleanly. */
export function applyCommandExit({ code, signal }: CommandResult): void {
  if (signal) {
    process.exitCode = signal === "SIGINT" ? INTERRUPT_EXIT_CODE : TERMINATION_EXIT_CODE;
    return;
  }

  process.exitCode = code ?? 1;
}
