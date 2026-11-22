import { homedir } from "node:os";
import { AUTH_BASE_PATH } from "../../apps/api/src/lib/auth-base-path.ts";
import { getPortlessEnvironment, getServiceUrl } from "./config.mts";
import { applyCommandExit, runForegroundCommand } from "./process.mts";
import { startProxy } from "./proxy.mts";

const currentDirectory = process.cwd();
const lanMode = process.argv.includes("--lan");

function getApiUrl(): string {
  if (process.env.PORTLESS === "0") {
    return "http://localhost:4000";
  }

  const environment = {
    ...process.env,
    ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode }),
  };

  startProxy({ currentDirectory, environment });

  return getServiceUrl({ currentDirectory, environment, serviceName: "api" });
}

const apiUrl = getApiUrl();

const result = await runForegroundCommand({
  args: [
    "listen",
    "--events",
    "checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted",
    "--forward-to",
    `${apiUrl}${AUTH_BASE_PATH}/stripe/webhook`,
  ],
  command: "stripe",
  currentDirectory,
  environment: process.env,
});

applyCommandExit(result);
