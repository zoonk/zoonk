import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getPnpmCommand } from "./process.mts";

const PORTLESS_CLI_PATTERN = /(?<packageDirectory>\S+)\/dist\/cli\.js\b/u;
const manifestSchema = z.object({ version: z.string() });

function readPortlessVersion(packageDirectory: string): string | undefined {
  try {
    const manifest = readFileSync(join(packageDirectory, "package.json"), "utf8");

    return manifestSchema.parse(JSON.parse(manifest)).version;
  } catch {
    return undefined;
  }
}

export function getPortlessPackageDirectory(command: string): string | undefined {
  return PORTLESS_CLI_PATTERN.exec(command)?.groups?.packageDirectory;
}

/**
 * The running proxy's Portless version, `null` when its install is gone, or undefined when no
 * Portless proxy runs (a stale PID file can name an unrelated process, which is never stopped).
 */
function getRunningProxyVersion(stateDirectory: string): string | null | undefined {
  try {
    const pid = readFileSync(join(stateDirectory, "proxy.pid"), "utf8").trim();
    const command = execFileSync("ps", ["-o", "command=", "-p", pid], { encoding: "utf8" });
    const packageDirectory = getPortlessPackageDirectory(command);

    return packageDirectory ? (readPortlessVersion(packageDirectory) ?? null) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A proxy only sees route changes the way its own version watches for them: 0.17 watches
 * `routes.json` itself, so once 0.18 replaces the file it never sees a new route. Every checkout
 * shares the proxy, so one left running by an older Portless, or by an install since deleted, gives
 * way to this checkout's. An older checkout keeps a newer proxy, which reads its routes fine.
 */
export function shouldReplaceProxy({
  ownVersion,
  proxyVersion,
}: {
  ownVersion: string;
  proxyVersion: string | null;
}): boolean {
  return !proxyVersion || proxyVersion.localeCompare(ownVersion, undefined, { numeric: true }) < 0;
}

/** Starts the checkout's shared proxy, replacing one an older Portless left running. */
export function startProxy({
  currentDirectory,
  environment,
}: {
  currentDirectory: string;
  environment: NodeJS.ProcessEnv;
}): void {
  const pnpmCommand = getPnpmCommand(environment);
  const stateDirectory = String(environment.PORTLESS_STATE_DIR);

  const portless = (command: string) =>
    execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "proxy", command], {
      cwd: currentDirectory,
      env: environment,
      // Its "already running" notice and restart advice answer nothing a `pnpm dev` asked; errors still show.
      stdio: ["ignore", "ignore", "inherit"],
    });

  const proxyVersion = getRunningProxyVersion(stateDirectory);

  const ownVersion = readPortlessVersion(
    dirname(dirname(fileURLToPath(import.meta.resolve("portless")))),
  );

  if (
    ownVersion &&
    proxyVersion !== undefined &&
    shouldReplaceProxy({ ownVersion, proxyVersion })
  ) {
    process.stdout.write(
      `Restarting the shared proxy on Portless ${ownVersion} (it ran ${proxyVersion ?? "an unknown version"})\n`,
    );

    portless("stop");
  }

  portless("start");
}
