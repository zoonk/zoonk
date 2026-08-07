import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import {
  getMailboxCaptureUrl,
  getPortlessEnvironment,
  getProjectName,
  getServiceName,
} from "./config.mts";
import { type CommandResult, applyCommandExit, runForegroundCommand } from "./process.mts";
import {
  type DevelopmentMode,
  getDevelopmentProcessRegistrationPath,
  getDevelopmentProcessRegistryDirectory,
  registerDevelopmentProcess,
  unregisterDevelopmentProcess,
} from "./registry.mts";

const currentDirectory = process.cwd();
const lanMode = process.argv.includes("--lan");

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
  const registryDirectory = getDevelopmentProcessRegistryDirectory(homedir());

  const registrationPath = getDevelopmentProcessRegistrationPath({
    launcherProcessId: process.pid,
    registryDirectory,
  });

  try {
    return await runForegroundCommand({
      args,
      command: "pnpm",
      currentDirectory,
      environment,
      onStart(childProcessId) {
        registerDevelopmentProcess({
          registration: { childProcessId, currentDirectory, launcherProcessId: process.pid, mode },
          registryDirectory,
        });
      },
      terminateProcessGroup: false,
    });
  } finally {
    unregisterDevelopmentProcess(registrationPath);
  }
}

/** Starts the dedicated proxy before Turbo launches apps so concurrent services never race to initialize shared state. */
function startProxy(environment: NodeJS.ProcessEnv): void {
  execFileSync("pnpm", ["exec", "portless", "proxy", "start"], {
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

  return execFileSync("pnpm", ["exec", "portless", "get", name], {
    cwd: currentDirectory,
    encoding: "utf8",
    env: environment,
  }).trim();
}

/** Runs the preserved fixed-port topology when Portless needs to be bypassed during the trial. */
async function startDirectDevelopment(): Promise<CommandResult> {
  return runDevelopmentCommand({
    args: ["exec", "turbo", "dev:direct"],
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
    args: ["exec", "turbo", "dev"],
    environment: {
      ...environment,
      MAILBOX_URL: getMailboxCaptureUrl(mailboxUrl),
      NEXT_PUBLIC_API_URL: apiUrl,
      ZOONK_DEV_PROJECT: projectName,
    },
    mode: lanMode ? "lan" : "localhost",
  });
}

const result =
  process.env.PORTLESS === "0" ? await startDirectDevelopment() : await startPortlessDevelopment();

applyCommandExit(result);
