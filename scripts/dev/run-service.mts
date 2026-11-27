import { homedir } from "node:os";
import { join } from "node:path";
import { getPortlessEnvironment, getProjectName, getServiceName } from "./config.mts";
import {
  applyCommandExit,
  getPnpmCommand,
  getStopWithLauncherEnvironment,
  runForegroundCommand,
} from "./process.mts";
import { claimServicePort } from "./service-port.mts";

const [serviceName, appScript = "dev:app"] = process.argv
  .slice(2)
  .filter((argument) => !argument.startsWith("--"));

if (!serviceName) {
  throw new Error("A development service name is required.");
}

const currentDirectory = process.cwd();
const lanMode = process.argv.includes("--lan") || process.env.PORTLESS_LAN === "1";

/**
 * The service stops with the `pnpm dev` or `pnpm start` that launched its stack, and with this
 * script: Turbo kills it when it force-stops the task, but not the service in its own process group.
 */
const stackLauncherPid = process.env.ZOONK_DEV_LAUNCHER_PID;
const launcherPids = stackLauncherPid ? [Number(stackLauncherPid), process.pid] : [process.pid];

const environment = {
  ...process.env,
  ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode }),
  ...getStopWithLauncherEnvironment({ environment: process.env, launcherPids }),
};

const pnpmCommand = getPnpmCommand(environment);
const projectName = getProjectName({ currentDirectory, environment });
const name = getServiceName({ projectName, serviceName });

const claim = await claimServicePort({
  fixedPort: process.env.PORTLESS_APP_PORT,
  stateDirectory: join(homedir(), ".portless-zoonk", "app-ports"),
});

try {
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
      // Next builds the URLs its proxy sees on `localhost`; under another hostname, Main's
      // locale rewrites count as external and redirect every English page to itself.
      ...(serviceName === "mailbox" ? [] : ["--hostname", "localhost"]),
    ],
    command: pnpmCommand.command,
    currentDirectory,
    environment: { ...environment, PORTLESS_APP_PORT: String(claim.port) },
  });

  applyCommandExit(result);
} finally {
  claim.release();
}
