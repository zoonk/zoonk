import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { getPortlessEnvironment } from "./config.mts";
import { getPnpmCommand } from "./process.mts";

const currentDirectory = process.cwd();
const pnpmCommand = getPnpmCommand(process.env);

function prunePortlessMode(lanMode: boolean): void {
  execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "prune"], {
    cwd: currentDirectory,
    env: { ...process.env, ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode }) },
    stdio: "inherit",
  });
}

prunePortlessMode(false);
prunePortlessMode(true);
