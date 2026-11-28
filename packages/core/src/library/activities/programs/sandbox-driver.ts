import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { safeAsync } from "@zoonk/utils/error";
import { type SandboxLanguage } from "./program-languages";
import { sandboxBaseName } from "./sandbox-bases";
import { SANDBOX_FORK_MS, SANDBOX_TOOLCHAINS } from "./sandbox-languages";

type SandboxFile = { path: string; content: string };
type Command = { cmd: string; args: string[]; sudo: boolean };

export type ProgramSandbox = {
  run: (command: Command) => Promise<number>;
  read: (path: string) => Promise<string>;
  write: (files: SandboxFile[]) => Promise<void>;
  stop: () => Promise<void>;
};

type ForkInput = {
  deadline?: AbortSignal;
  language: SandboxLanguage;
  name: string;
  timeoutMs: number;
};

export type SandboxDriver = {
  fork: (input: ForkInput) => Promise<ProgramSandbox>;
  reuse: (input: {
    deadline?: AbortSignal;
    name: string;
    timeoutMs: number;
  }) => Promise<ProgramSandbox>;
};

export type SandboxOptions = Pick<Parameters<typeof Sandbox.get>[0], "fetch" | "getAuthHeaders"> &
  (
    | { projectId: string; teamId: string; token: string }
    | {
        projectId: string;
        teamId: string;
        getAuthHeaders: NonNullable<Parameters<typeof Sandbox.get>[0]["getAuthHeaders"]>;
      }
  );

const IO_TIMEOUT_MS = 3000;
const COMMAND_TIMEOUT_MS = 26_000;
const BASE_TIMEOUT_MS = 900_000;
const INSTALL_ERROR_TAIL = 2000;

function sandboxCommands(sandbox: Sandbox, deadline?: AbortSignal): ProgramSandbox {
  const session = sandbox.currentSession();

  function withDeadline(ms: number) {
    const signal = AbortSignal.timeout(ms);
    return deadline ? AbortSignal.any([deadline, signal]) : signal;
  }

  return {
    read: async (path) => {
      const buffer = await session.readFileToBuffer(
        { path },
        { signal: withDeadline(IO_TIMEOUT_MS) },
      );

      if (!buffer) {
        throw new Error("Sandbox output file is missing");
      }

      return buffer.toString("utf8").replaceAll(String.fromCodePoint(0), "\uFFFD");
    },
    run: async (command) => {
      const result = await session.runCommand({
        ...command,
        signal: withDeadline(COMMAND_TIMEOUT_MS),
      });

      return result.exitCode;
    },
    stop: async () => {
      await session.stop({ signal: AbortSignal.timeout(IO_TIMEOUT_MS) });
    },
    write: (files) => session.writeFiles(files, { signal: withDeadline(IO_TIMEOUT_MS) }),
  };
}

export function createSandboxDriver(options?: SandboxOptions): SandboxDriver {
  return {
    fork: async ({ deadline, language, name, timeoutMs }) => {
      const forkDeadline = AbortSignal.timeout(SANDBOX_FORK_MS);

      const fork = await Sandbox.fork({
        ...options,
        env: {},
        name,
        networkPolicy: "deny-all",
        persistent: false,
        ports: [],
        region: "iad1",
        resources: { vcpus: SANDBOX_TOOLCHAINS[language].vcpus },
        signal: deadline ? AbortSignal.any([deadline, forkDeadline]) : forkDeadline,
        sourceSandbox: sandboxBaseName(language),
        timeout: timeoutMs,
      });

      if (!fork.sourceSnapshotId) {
        await safeAsync(() => sandboxCommands(fork).stop());
        throw new Error("The program sandbox base has no snapshot");
      }

      return sandboxCommands(fork, deadline);
    },
    reuse: async ({ deadline, name, timeoutMs }) => {
      const reuseDeadline = AbortSignal.timeout(IO_TIMEOUT_MS);
      const signal = deadline ? AbortSignal.any([deadline, reuseDeadline]) : reuseDeadline;
      const sandbox = await Sandbox.get({ ...options, name, resume: false, signal });

      if (
        sandbox.status !== "running" ||
        sandbox.persistent ||
        !sandbox.sourceSnapshotId ||
        !sandbox.expiresAt
      ) {
        throw new Error("The program sandbox is no longer available");
      }

      const extraMs = Date.now() + timeoutMs - sandbox.expiresAt.getTime();

      if (extraMs > 0) {
        await sandbox.currentSession().extendTimeout(extraMs, { signal });
      }

      return sandboxCommands(sandbox, deadline);
    },
  };
}

export const sandboxDriver = createSandboxDriver();

export async function sandboxBase({
  language,
  options,
}: {
  language: SandboxLanguage;
  options?: SandboxOptions;
}) {
  const name = sandboxBaseName(language);
  const config = { ...options, name, resume: false };

  const base = await Sandbox.getOrCreate({
    ...config,
    persistent: true,
    region: "iad1",
    resources: { vcpus: SANDBOX_TOOLCHAINS[language].vcpus },
    snapshotExpiration: 0,
    timeout: BASE_TIMEOUT_MS,
  });

  return {
    alreadyBuilt:
      base.status === "stopped" &&
      Boolean(base.currentSnapshotId) &&
      base.tags?.zoonkCodeReady === "yes",
    install: async (script: string) => {
      const command = await base.runCommand({
        args: ["-euc", script],
        cmd: "/bin/bash",
        sudo: true,
      });

      if (command.exitCode !== 0) {
        const diagnostics = await command.stderr();

        throw new Error(
          `Base installation failed for ${language}: ${diagnostics.slice(-INSTALL_ERROR_TAIL)}`,
        );
      }

      return sandboxCommands(base);
    },
    seal: async () => {
      await base.update({ tags: { zoonkCodeReady: "yes" } });
      await base.stop();
      const stopped = await Sandbox.get(config);

      if (stopped.status !== "stopped" || !stopped.currentSnapshotId) {
        throw new Error(`Program base ${name} did not produce a snapshot`);
      }
    },
    stop: async () => {
      await base.stop();
    },
  };
}
