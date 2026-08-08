import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { getPortlessEnvironment, getProjectName, getServiceName } from "./config.mts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./process.mts";

const currentDirectory = process.cwd();
const lanMode = process.argv.includes("--lan");
const pnpmCommand = getPnpmCommand(process.env);

/** Resolves the API callback through the active development topology so Stripe follows the same clone or linked worktree as the listener. */
function getApiUrl(): string {
  if (process.env.PORTLESS === "0") {
    return "http://localhost:4000";
  }

  const projectName = getProjectName({ currentDirectory });
  const name = getServiceName({ projectName, serviceName: "api" });

  const environment = {
    ...process.env,
    ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode }),
  };

  execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "proxy", "start"], {
    cwd: currentDirectory,
    env: environment,
    stdio: "inherit",
  });

  return execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "get", name], {
    cwd: currentDirectory,
    encoding: "utf8",
    env: environment,
  }).trim();
}

const apiUrl = getApiUrl();

const result = await runForegroundCommand({
  args: ["listen", "--forward-to", `${apiUrl}/v1/auth/stripe/webhook`],
  command: "stripe",
  currentDirectory,
  environment: process.env,
});

applyCommandExit(result);
