import { homedir } from "node:os";
import {
  getMailboxCaptureUrl,
  getPortlessEnvironment,
  getProjectName,
  getServiceUrl,
} from "./config.mts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./process.mts";

const currentDirectory = process.cwd();
const pnpmCommand = getPnpmCommand(process.env);

const service = {
  currentDirectory,
  environment: {
    ...process.env,
    ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode: false }),
  },
  projectName: getProjectName({ currentDirectory }),
};

/** Runs the API's persona command with the URLs `pnpm dev` serves, so it prints where to sign in. */
const result = await runForegroundCommand({
  args: [...pnpmCommand.args, "--filter", "api", "persona", ...process.argv.slice(2)],
  command: pnpmCommand.command,
  currentDirectory,
  environment: {
    ...process.env,
    MAILBOX_URL: getMailboxCaptureUrl(getServiceUrl({ ...service, serviceName: "mailbox" })),
    MAIN_APP_URL: getServiceUrl({ ...service, serviceName: "main" }),
  },
});

applyCommandExit(result);
