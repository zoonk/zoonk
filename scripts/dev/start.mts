import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import {
  getMailboxCaptureUrl,
  getPortlessEnvironment,
  getProjectName,
  getServiceName,
} from "./config.mts";
import {
  type CommandResult,
  applyCommandExit,
  getPnpmCommand,
  runForegroundCommand,
} from "./process.mts";
import {
  type DevelopmentMode,
  getDevelopmentProcessRegistrationPath,
  getDevelopmentProcessRegistryDirectory,
  registerDevelopmentProcess,
  registerDevelopmentProcessStartup,
  unregisterDevelopmentProcess,
} from "./registry.mts";

const currentDirectory = process.cwd();
const directMode = process.argv.includes("--direct");
const lanMode = process.argv.includes("--lan");
const pnpmCommand = getPnpmCommand(process.env);
const registryDirectory = getDevelopmentProcessRegistryDirectory(homedir());

const registrationPath = getDevelopmentProcessRegistrationPath({
  launcherProcessId: process.pid,
  registryDirectory,
});

const startupPath = registerDevelopmentProcessStartup({
  launcherProcessId: process.pid,
  registryDirectory,
});

/** Records one root task runner for the lifetime of a stack so another worktree can stop it without scanning unrelated system processes. */
async function runDevelopmentCommand({
  args,
  environment,
  mode,
}: {
  args: string[];
  environment: NodeJS.ProcessEnv;
  mode: DevelopmentMode;
}): Promise<CommandResult> {
  return runForegroundCommand({
    args: [...pnpmCommand.args, ...args],
    command: pnpmCommand.command,
    currentDirectory,
    environment,
    onStart(childProcessId) {
      registerDevelopmentProcess({
        registration: {
          childProcessId,
          currentDirectory,
          launcherProcessId: process.pid,
          mode,
          registryVersion: 2,
        },
        registryDirectory,
      });

      unregisterDevelopmentProcess(startupPath);
    },
    terminateProcessGroup: false,
  });
}

/** Starts the dedicated proxy before Turbo launches apps so concurrent services never race to initialize shared state. */
function startProxy(environment: NodeJS.ProcessEnv): void {
  execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "proxy", "start"], {
    cwd: currentDirectory,
    env: environment,
    stdio: "inherit",
  });
}

/** Uses Portless's own worktree-aware resolver so every consumer receives the exact URL registered by its service. */
function getServiceUrl({
  environment,
  projectName,
  serviceName,
}: {
  environment: NodeJS.ProcessEnv;
  projectName: string;
  serviceName: string;
}): string {
  const name = getServiceName({ projectName, serviceName });

  return execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "get", name], {
    cwd: currentDirectory,
    encoding: "utf8",
    env: environment,
  }).trim();
}

/** Runs the preserved fixed-port topology when Portless needs to be bypassed during the trial. */
async function startDirectDevelopment(): Promise<CommandResult> {
  return runDevelopmentCommand({
    args: ["exec", "turbo", "dev:direct", `--cwd=${currentDirectory}`],
    environment: process.env,
    mode: "direct",
  });
}

/** Resolves shared service URLs once before Next.js captures public environment variables at startup. */
async function startPortlessDevelopment(): Promise<CommandResult> {
  const projectName = getProjectName({ currentDirectory });
  const portlessEnvironment = getPortlessEnvironment({ homeDirectory: homedir(), lanMode });
  const environment = { ...process.env, ...portlessEnvironment };

  startProxy(environment);

  const apiUrl = getServiceUrl({ environment, projectName, serviceName: "api" });
  const mailboxUrl = getServiceUrl({ environment, projectName, serviceName: "mailbox" });

  process.stdout.write(`API: ${apiUrl}\nMailbox: ${mailboxUrl}\n`);

  return runDevelopmentCommand({
    args: ["exec", "turbo", "dev", `--cwd=${currentDirectory}`],
    environment: {
      ...environment,
      MAILBOX_URL: getMailboxCaptureUrl(mailboxUrl),
      NEXT_PUBLIC_API_URL: apiUrl,
      ZOONK_DEV_PROJECT: projectName,
    },
    mode: lanMode ? "lan" : "localhost",
  });
}

try {
  const result =
    directMode || process.env.PORTLESS === "0"
      ? await startDirectDevelopment()
      : await startPortlessDevelopment();

  applyCommandExit(result);
} finally {
  unregisterDevelopmentProcess(startupPath);
  unregisterDevelopmentProcess(registrationPath);
}
