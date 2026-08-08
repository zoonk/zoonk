import { execFileSync } from "node:child_process";
import { basename, dirname, join } from "node:path";

const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

/**
 * Uses the primary checkout directory as the stable namespace for every service in a clone. Linked Git worktrees share that directory and receive Portless's branch prefix, while separate clones remain isolated even when they use the same branch name.
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

/** Resolves the shared Git directory so linked worktrees agree on one clone namespace. */
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

/** Gives each app a readable route while keeping every clone in its own namespace. */
export function getServiceName({
  projectName,
  serviceName,
}: {
  projectName: string;
  serviceName: string;
}): string {
  return `${serviceName}.${projectName}`;
}

/**
 * Keeps Zoonk's local proxy independent from other Portless projects and avoids privileged ports or certificate installation. LAN mode uses separate state so device testing never reconfigures another agent's localhost proxy.
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

/** Targets the mailbox's HTTP capture endpoint without coupling mail delivery to its internal process port. */
export function getMailboxCaptureUrl(mailboxServiceUrl: string): string {
  return new URL("/api/emails", mailboxServiceUrl).toString();
}
