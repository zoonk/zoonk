import { execFileSync } from "node:child_process";
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
import { writeAppleDevelopmentConfiguration } from "./write-apple-configuration.mts";

const currentDirectory = process.cwd();
const directMode = process.argv.includes("--direct");
const lanMode = process.argv.includes("--lan");
/** `pnpm start` builds every app for these URLs and serves the production builds instead of development servers. */
const productionMode = process.argv.includes("--production");
const pnpmCommand = getPnpmCommand(process.env);

/** Runs Turbo in the foreground so its normal terminal shutdown owns the complete development stack. */
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
    environment,
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

/** Runs the preserved fixed-port topology when Portless needs to be bypassed during the trial. */
async function startDirectDevelopment(): Promise<CommandResult> {
  writeAppleDevelopmentConfiguration({ apiUrl: "http://localhost:4000", currentDirectory });

  return runDevelopmentCommand({ args: ["exec", "turbo", "dev:direct"], environment: process.env });
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
  process.stdout.write(`Main: ${mainUrl}\nAPI: ${apiUrl}\nMailbox: ${mailboxUrl}\n`);

  return runDevelopmentCommand({
    args: ["exec", "turbo", productionMode ? "start" : "dev"],
    environment: {
      ...environment,
      MAILBOX_URL: getMailboxCaptureUrl(mailboxUrl),
      MAIN_APP_URL: mainUrl,
      NEXT_PUBLIC_API_URL: apiUrl,
      // Vercel's name for a run on this machine (as in `vercel dev`), so production builds keep local sign-in and mail.
      VERCEL_ENV: "development",
      // Each service stops with this process however it ends; see `stop-with-launcher.mts`.
      ZOONK_DEV_LAUNCHER_PID: String(process.pid),
      ZOONK_DEV_PROJECT: projectName,
    },
  });
}

const result =
  !productionMode && (directMode || process.env.PORTLESS === "0")
    ? await startDirectDevelopment()
    : await startPortlessDevelopment();

applyCommandExit(result);
