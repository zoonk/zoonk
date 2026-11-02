import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { getPnpmCommand } from "./process.mts";

const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

/**
 * Linked worktrees share the primary checkout's directory and get Portless's branch prefix, while
 * separate clones stay isolated even on the same branch name.
 */
function getProjectNameFromCommonDirectory({
  gitCommonDirectory,
  override,
}: {
  gitCommonDirectory: string;
  override?: string;
}): string {
  const projectName = override || basename(dirname(gitCommonDirectory));

  if (!DNS_LABEL_PATTERN.test(projectName)) {
    throw new Error(
      `The development project name "${projectName}" must be a valid DNS label. Set ZOONK_DEV_PROJECT to a lowercase name containing only letters, numbers, and hyphens.`,
    );
  }

  return projectName;
}

export function getProjectName({
  currentDirectory,
  environment = process.env,
}: {
  currentDirectory: string;
  environment?: NodeJS.ProcessEnv;
}): string {
  const gitCommonDirectory = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: currentDirectory, encoding: "utf8" },
  ).trim();

  return getProjectNameFromCommonDirectory({
    gitCommonDirectory,
    override: environment.ZOONK_DEV_PROJECT,
  });
}

export function getServiceName({
  projectName,
  serviceName,
}: {
  projectName: string;
  serviceName: string;
}): string {
  return `${serviceName}.${projectName}`;
}

export function getServiceUrl({
  currentDirectory,
  environment = {
    ...process.env,
    ...getPortlessEnvironment({ homeDirectory: homedir(), lanMode: false }),
  },
  projectName = getProjectName({ currentDirectory, environment }),
  serviceName,
}: {
  currentDirectory: string;
  environment?: NodeJS.ProcessEnv;
  projectName?: string;
  serviceName: string;
}): string {
  const pnpmCommand = getPnpmCommand(environment);
  const name = getServiceName({ projectName, serviceName });

  return execFileSync(pnpmCommand.command, [...pnpmCommand.args, "exec", "portless", "get", name], {
    cwd: currentDirectory,
    encoding: "utf8",
    env: environment,
  }).trim();
}

/**
 * LAN mode keeps separate state, so device testing never reconfigures another agent's localhost
 * proxy.
 */
export function getPortlessEnvironment({
  homeDirectory,
  lanMode,
}: {
  homeDirectory: string;
  lanMode: boolean;
}): NodeJS.ProcessEnv {
  return {
    PORTLESS_HTTPS: "0",
    PORTLESS_LAN: lanMode ? "1" : "0",
    PORTLESS_PORT: lanMode ? "1356" : "1355",
    PORTLESS_STATE_DIR: join(homeDirectory, lanMode ? ".portless-zoonk-lan" : ".portless-zoonk"),
    PORTLESS_SYNC_HOSTS: "0",
  };
}

export function getMailboxCaptureUrl(mailboxServiceUrl: string): string {
  return new URL("/api/emails", mailboxServiceUrl).toString();
}
