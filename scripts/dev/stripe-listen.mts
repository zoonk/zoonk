import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { getPortlessEnvironment, getServiceUrl } from "./config.mts";
import { applyCommandExit, getPnpmCommand, runForegroundCommand } from "./process.mts";

const currentDirectory = process.cwd();
const lanMode = process.argv.includes("--lan");
const pnpmCommand = getPnpmCommand(process.env);

function getApiUrl(): string {
  if (process.env.PORTLESS === "0") {
    return "http://localhost:4000";
  }

  const environment = {
    ...process.env,
    ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode }),
  };

  execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "proxy", "start"], {
    cwd: currentDirectory,
    env: environment,
    stdio: "inherit",
  });

  return getServiceUrl({ currentDirectory, environment, serviceName: "api" });
}

const apiUrl = getApiUrl();

const result = await runForegroundCommand({
  args: [
    "listen",
    "--events",
    "checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted",
    "--forward-to",
    `${apiUrl}/v1/auth/stripe/webhook`,
  ],
  command: "stripe",
  currentDirectory,
  environment: process.env,
});

applyCommandExit(result);
