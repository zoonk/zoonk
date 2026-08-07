import { execFileSync } from "node:child_process";

export type ExpectedCommand = (command: string) => boolean;
export type ProcessSignal = "SIGKILL" | "SIGTERM";

type ProcessCommandLookup = { args: string[]; command: string };

/** Uses the operating system's process inventory without asking a shell to interpret the PID or command. */
function getProcessCommandLookup(processId: number): ProcessCommandLookup {
  if (process.platform === "win32") {
    const script = [
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      `$targetProcess = Get-CimInstance Win32_Process -Filter "ProcessId = ${processId}"`,
      "if ($null -ne $targetProcess) { [Console]::Out.Write($targetProcess.CommandLine) }",
    ].join("; ");

    return {
      args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      command: "powershell.exe",
    };
  }

  return { args: ["-ww", "-p", String(processId), "-o", "command="], command: "ps" };
}

/** Terminates one validated Windows owner and every descendant because Windows has no POSIX process-group signals. */
function terminateWindowsProcessTree(processId: number): boolean {
  try {
    execFileSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Signals one exact managed process after checking its command immediately before the operating-system call. */
function signalExpectedProcess({
  isExpectedCommand,
  processId,
  signal,
}: {
  isExpectedCommand: ExpectedCommand;
  processId: number;
  signal: ProcessSignal;
}): boolean {
  if (!isExpectedProcess({ isExpectedCommand, processId })) {
    return false;
  }

  try {
    process.kill(processId, signal);
    return true;
  } catch {
    return false;
  }
}

/** Reads the command currently attached to a PID so stale registry entries cannot stop an unrelated process after PID reuse. */
export function getProcessCommand(processId: number): string | null {
  try {
    const lookup = getProcessCommandLookup(processId);

    return (
      execFileSync(lookup.command, lookup.args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

/** Reports a process as managed only while its live command still matches the role recorded by the development launcher. */
export function isExpectedProcess({
  isExpectedCommand,
  processId,
}: {
  isExpectedCommand: ExpectedCommand;
  processId: number;
}): boolean {
  const command = getProcessCommand(processId);

  return command !== null && isExpectedCommand(command);
}

/** Stops the full managed tree on Windows or its detached process group on POSIX after validating the current owner. */
export function signalExpectedProcessTree({
  isExpectedCommand,
  processId,
  signal,
}: {
  isExpectedCommand: ExpectedCommand;
  processId: number;
  signal: ProcessSignal;
}): boolean {
  if (!isExpectedProcess({ isExpectedCommand, processId })) {
    return false;
  }

  if (process.platform === "win32") {
    return terminateWindowsProcessTree(processId);
  }

  try {
    process.kill(-processId, signal);
    return true;
  } catch {
    return signalExpectedProcess({ isExpectedCommand, processId, signal });
  }
}
