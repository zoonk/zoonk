import { getProjectName, getServiceName } from "./config.mts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./process.mts";

const [serviceName] = process.argv.slice(2);

if (!serviceName) {
  throw new Error("A development service name is required.");
}

const currentDirectory = process.cwd();
const pnpmCommand = getPnpmCommand(process.env);
const projectName = getProjectName({ currentDirectory });
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
    "dev:app",
  ],
  command: pnpmCommand.command,
  currentDirectory,
  environment: process.env,
});

applyCommandExit(result);
