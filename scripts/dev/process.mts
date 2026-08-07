import { spawn } from "node:child_process";

const INTERRUPT_EXIT_CODE = 130;
const TERMINATION_EXIT_CODE = 143;

export type CommandResult = { code: number | null; signal: NodeJS.Signals | null };

/**
 * Runs an interactive child with the current terminal attached and reports its real exit status. Keeping process ownership here makes the root launcher and Stripe listener behave consistently when an agent stops them.
 */
export function runForegroundCommand({
  args,
  command,
  currentDirectory,
  environment,
  onStart,
  terminateProcessGroup = true,
}: {
  args: string[];
  command: string;
  currentDirectory: string;
  environment: NodeJS.ProcessEnv;
  onStart?: (childProcessId: number) => void;
  terminateProcessGroup?: boolean;
}): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const usesProcessGroup = process.platform !== "win32";

    const child = spawn(command, args, {
      cwd: currentDirectory,
      detached: usesProcessGroup,
      env: environment,
      stdio: "inherit",
    });

    /** Ensures stopping a wrapper also stops Portless and every dev server nested below it. */
    function forwardSignal(signal: NodeJS.Signals): void {
      if (!child.pid || child.exitCode !== null) {
        return;
      }

      if (usesProcessGroup && terminateProcessGroup) {
        process.kill(-child.pid, signal);
        return;
      }

      child.kill(signal);
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

    try {
      if (child.pid) {
        onStart?.(child.pid);
      }
    } catch (error) {
      forwardTermination();
      removeSignalHandlers();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
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
