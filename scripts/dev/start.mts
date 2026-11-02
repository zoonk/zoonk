import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import {
  getMailboxCaptureUrl,
  getPortlessEnvironment,
  getProjectName,
  getServiceUrl,
} from "./config.mts";
import {
  type CommandResult,
  applyCommandExit,
  getPnpmCommand,
  runForegroundCommand,
} from "./process.mts";
import { waitForTurn } from "./queue.mts";
import { writeAndroidDevelopmentConfiguration } from "./write-android-configuration.mts";
import { writeAppleDevelopmentConfiguration } from "./write-apple-configuration.mts";

const currentDirectory = process.cwd();
const directMode = process.argv.includes("--direct");
const lanMode = process.argv.includes("--lan");
const productionMode = process.argv.includes("--production");
const pnpmCommand = getPnpmCommand(process.env);

// Sign-in codes go to the mailbox, so it runs with any app list.
const apps = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const filters = apps.length > 0 ? [...apps, "mailbox"].map((app) => `--filter=${app}`) : [];

async function runDevelopmentCommand({
  args,
  environment,
}: {
  args: string[];
  environment: NodeJS.ProcessEnv;
}): Promise<CommandResult> {
  return runForegroundCommand({
    args: [...pnpmCommand.args, ...args],
    command: pnpmCommand.command,
    currentDirectory,
    environment: {
      APP_CACHE_SECRET: randomUUID(),
      APP_FOLLOW_UP_SECRET: randomUUID(),
      ...environment,
    },
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

async function startDirectDevelopment(): Promise<CommandResult> {
  writeAppleDevelopmentConfiguration({ apiUrl: "http://localhost:4000", currentDirectory });
  writeAndroidDevelopmentConfiguration({ apiUrl: "http://localhost:4000", currentDirectory });

  return runDevelopmentCommand({
    args: ["exec", "turbo", "dev:direct", ...filters],
    environment: process.env,
  });
}

/** The build takes a turn with the machine's other heavy jobs; the servers that follow don't hold it. */
async function buildForProduction(environment: NodeJS.ProcessEnv): Promise<CommandResult> {
  const turn = await waitForTurn();

  try {
    return await runDevelopmentCommand({
      args: ["exec", "turbo", "build", ...filters],
      environment: { ...environment, ...turn?.environment },
    });
  } finally {
    turn?.release();
  }
}

/** Resolves shared service URLs once before Next.js captures public environment variables at startup or build. */
async function startPortlessDevelopment(): Promise<CommandResult> {
  const projectName = getProjectName({ currentDirectory });
  const portlessEnvironment = getPortlessEnvironment({ homeDirectory: homedir(), lanMode });
  const environment = { ...process.env, ...portlessEnvironment };

  startProxy(environment);

  const service = { currentDirectory, environment, projectName };
  const mainUrl = getServiceUrl({ ...service, serviceName: "main" });
  const apiUrl = getServiceUrl({ ...service, serviceName: "api" });
  const mailboxUrl = getServiceUrl({ ...service, serviceName: "mailbox" });

  writeAppleDevelopmentConfiguration({ apiUrl, currentDirectory });
  writeAndroidDevelopmentConfiguration({ apiUrl, currentDirectory });
  process.stdout.write(`Main: ${mainUrl}\nAPI: ${apiUrl}\nMailbox: ${mailboxUrl}\n`);

  const stackEnvironment = {
    ...environment,
    MAILBOX_URL: getMailboxCaptureUrl(mailboxUrl),
    MAIN_APP_URL: mainUrl,
    NEXT_PUBLIC_API_URL: apiUrl,
    // Vercel's name for a run on this machine (as in `vercel dev`), so production builds keep local sign-in and mail.
    VERCEL_ENV: "development",
    // Each service stops with this process however it ends; see `stop-with-launcher.mts`.
    ZOONK_DEV_LAUNCHER_PID: String(process.pid),
    ZOONK_DEV_PROJECT: projectName,
  };

  if (!productionMode) {
    return runDevelopmentCommand({
      args: ["exec", "turbo", "dev", ...filters],
      environment: stackEnvironment,
    });
  }

  const build = await buildForProduction(stackEnvironment);

  if (build.code !== 0 || build.signal) {
    return build;
  }

  return runDevelopmentCommand({
    args: ["exec", "turbo", "start", "--only", ...filters],
    environment: stackEnvironment,
  });
}

const result =
  !productionMode && (directMode || process.env.PORTLESS === "0")
    ? await startDirectDevelopment()
    : await startPortlessDevelopment();

applyCommandExit(result);
