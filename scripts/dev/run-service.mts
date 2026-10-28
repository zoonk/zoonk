import { homedir } from "node:os";
import { getPortlessEnvironment, getProjectName, getServiceName } from "./config.mts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./process.mts";

/** The app script Portless serves: its development server by default, or `start:app` for `pnpm start`. */
const [serviceName, appScript = "dev:app"] = process.argv
  .slice(2)
  .filter((argument) => !argument.startsWith("--"));

if (!serviceName) {
  throw new Error("A development service name is required.");
}

const currentDirectory = process.cwd();
const lanMode = process.argv.includes("--lan") || process.env.PORTLESS_LAN === "1";

/** `pnpm dev` and `pnpm start` pass their own process; a service started on its own is launched by this script. */
const launcherPid = process.env.ZOONK_DEV_LAUNCHER_PID ?? String(process.pid);
const stopWithLauncher = `--import=${import.meta.resolve("./stop-with-launcher.mts")}`;

const environment = {
  ...process.env,
  ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode }),
  NODE_OPTIONS: [process.env.NODE_OPTIONS, stopWithLauncher].filter(Boolean).join(" "),
  ZOONK_DEV_LAUNCHER_PID: launcherPid,
};

const pnpmCommand = getPnpmCommand(environment);
const projectName = getProjectName({ currentDirectory, environment });
const name = getServiceName({ projectName, serviceName });

/** Gives Portless one clone-scoped service name while leaving application and child-process ownership to Portless and Turbo. */
const result = await runForegroundCommand({
  args: [
    ...pnpmCommand.args,
    "exec",
    "portless",
    "run",
    "--name",
    name,
    pnpmCommand.command,
    ...pnpmCommand.args,
    "run",
    appScript,
  ],
  command: pnpmCommand.command,
  currentDirectory,
  environment,
});

applyCommandExit(result);
