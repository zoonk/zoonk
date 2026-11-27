import { realpathSync } from "node:fs";
import { requireDevelopmentDatabase } from "../worktree/databases.mts";
import { getMailboxCaptureUrl, getServiceUrl } from "./config.mts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./process.mts";

const currentDirectory = process.cwd();
const pnpmCommand = getPnpmCommand(process.env);

await requireDevelopmentDatabase(realpathSync(currentDirectory));

const result = await runForegroundCommand({
  args: [...pnpmCommand.args, "--filter", "api", "persona", ...process.argv.slice(2)],
  command: pnpmCommand.command,
  currentDirectory,
  environment: {
    ...process.env,
    MAILBOX_URL: getMailboxCaptureUrl(getServiceUrl({ currentDirectory, serviceName: "mailbox" })),
    MAIN_APP_URL: getServiceUrl({ currentDirectory, serviceName: "main" }),
  },
});

applyCommandExit(result);
