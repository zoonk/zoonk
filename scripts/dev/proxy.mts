import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getPnpmCommand } from "./process.mts";

// Everything after the Node binary up to Portless's entry point, so a checkout path may hold spaces.
const PROXY_COMMAND_PATTERN =
  /^\S+ (?<packageDirectory>.+\/portless)\/dist\/cli\.js proxy start\b/u;

const PNPM_VERSION_PATTERN = /\/portless@(?<version>[^/_]+)\/node_modules\/portless$/u;
const manifestSchema = z.object({ version: z.string() });

/** pnpm names the install's folder after its version, which outlives a removed worktree's manifest. */
function readPortlessVersion(packageDirectory: string): string | undefined {
  const version = PNPM_VERSION_PATTERN.exec(packageDirectory)?.groups?.version;

  if (version) {
    return version;
  }

  try {
    const manifest = readFileSync(join(packageDirectory, "package.json"), "utf8");

    return manifestSchema.parse(JSON.parse(manifest)).version;
  } catch {
    return undefined;
  }
}

export function getProxyPackageDirectory(command: string): string | undefined {
  return PROXY_COMMAND_PATTERN.exec(command.trim())?.groups?.packageDirectory;
}

/**
 * The running proxy's Portless version, or undefined when none can be found: a stale PID file can
 * name an unrelated process, which is never stopped.
 */
function getRunningProxyVersion(stateDirectory: string): string | undefined {
  try {
    const pid = readFileSync(join(stateDirectory, "proxy.pid"), "utf8").trim();
    const command = execFileSync("ps", ["-o", "command=", "-p", pid], { encoding: "utf8" });
    const packageDirectory = getProxyPackageDirectory(command);

    return packageDirectory ? readPortlessVersion(packageDirectory) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A proxy only sees route changes the way its own version watches for them: 0.17 watches
 * `routes.json` itself, so once 0.18 replaces the file it never sees a new route. Every checkout
 * shares the proxy, so one left running by an older Portless gives way to this checkout's. An older
 * checkout keeps a newer proxy, which reads its routes fine.
 */
export function shouldReplaceProxy({
  ownVersion,
  proxyVersion,
}: {
  ownVersion: string;
  proxyVersion: string;
}): boolean {
  return proxyVersion.localeCompare(ownVersion, undefined, { numeric: true }) < 0;
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

  // Started first, so the check sees whichever proxy won when several checkouts start at once.
  portless("start");

  const proxyVersion = getRunningProxyVersion(stateDirectory);

  const ownVersion = readPortlessVersion(
    dirname(dirname(fileURLToPath(import.meta.resolve("portless")))),
  );

  if (ownVersion && proxyVersion && shouldReplaceProxy({ ownVersion, proxyVersion })) {
    process.stdout.write(
      `Restarting the shared proxy on Portless ${ownVersion} (it ran ${proxyVersion})\n`,
    );

    portless("stop");
    portless("start");
  }
}
