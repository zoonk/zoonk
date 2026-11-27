import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import { updateDevelopmentDatabase } from "../worktree/databases.mts";
import { readsDatabase } from "../worktree/environment.mts";
import { clearProductionBuildOutput } from "./build-output.mts";
import {
  getMailboxCaptureUrl,
  getPortlessEnvironment,
  getProjectName,
  getServiceUrl,
} from "./config.mts";
import {
  type CommandResult,
  applyCommandExit,
  getPnpmCommand,
  runForegroundCommand,
} from "./process.mts";
import { startProxy } from "./proxy.mts";
import { waitForTurn } from "./queue.mts";
import { type Service, announceWhenReady, formatServices, sortServices } from "./ready.mts";
import { writeAndroidDevelopmentConfiguration } from "./write-android-configuration.mts";
import { writeAppleDevelopmentConfiguration } from "./write-apple-configuration.mts";

const currentDirectory = process.cwd();
const directMode = process.argv.includes("--direct");
const lanMode = process.argv.includes("--lan");
const productionMode = process.argv.includes("--production");
const pnpmCommand = getPnpmCommand(process.env);

// Sign-in codes go to the mailbox, so it runs with any app list.
const apps = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const filters = apps.length > 0 ? [...apps, "mailbox"].map((app) => `--filter=${app}`) : [];

/** With no app named, Turbo starts every app whose `dev` script is a service. */
function getStartedApps(): string[] {
  const appsDirectory = join(currentDirectory, "apps");

  const candidates = readdirSync(appsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return candidates.filter((app) => {
    if (apps.length > 0 && app !== "mailbox" && !apps.includes(app)) {
      return false;
    }

    const manifest = join(appsDirectory, app, "package.json");

    return existsSync(manifest) && readFileSync(manifest, "utf8").includes("run-service.mts");
  });
}

async function runDevelopmentCommand({
  args,
  environment,
}: {
  args: string[];
  environment: NodeJS.ProcessEnv;
}): Promise<CommandResult> {
  return runForegroundCommand({
    args: [...pnpmCommand.args, ...args],
    command: pnpmCommand.command,
    currentDirectory,
    environment: {
      APP_CACHE_SECRET: randomUUID(),
      APP_FOLLOW_UP_SECRET: randomUUID(),
      ...environment,
    },
  });
}

async function startDirectDevelopment(): Promise<CommandResult> {
  writeAppleDevelopmentConfiguration({ apiUrl: "http://localhost:4000", currentDirectory });
  writeAndroidDevelopmentConfiguration({ apiUrl: "http://localhost:4000", currentDirectory });

  return runDevelopmentCommand({
    args: ["exec", "turbo", "dev:direct", ...filters],
    environment: process.env,
  });
}

/** The build takes a turn with the machine's other heavy jobs; the servers that follow don't hold it. */
async function buildForProduction({
  environment,
  startedApps,
}: {
  environment: NodeJS.ProcessEnv;
  startedApps: string[];
}): Promise<CommandResult> {
  const turn = await waitForTurn();

  try {
    for (const app of startedApps) {
      clearProductionBuildOutput(join(currentDirectory, "apps", app));
    }

    return await runDevelopmentCommand({
      args: ["exec", "turbo", "build", ...filters],
      environment: { ...environment, ...turn?.environment },
    });
  } finally {
    turn?.release();
  }
}

function trustLanCertificate(caPath: string): string {
  const ca = readFileSync(caPath, "utf8");
  setDefaultCACertificates([...getCACertificates(), ca]);

  const extra = getCACertificates("extra");

  if (extra.length === 0) {
    return caPath;
  }

  const directory = mkdtempSync(join(tmpdir(), "zoonk-lan-ca-"));
  process.once("exit", () => rmSync(directory, { force: true, recursive: true }));
  const bundle = join(directory, "ca.pem");
  writeFileSync(bundle, [...extra, ca].join("\n"), { mode: 0o600 });
  return bundle;
}

/** Resolves shared service URLs once before Next.js captures public environment variables at startup or build. */
async function startPortlessDevelopment(startedApps: string[]): Promise<CommandResult> {
  const projectName = getProjectName({ currentDirectory });
  const portlessEnvironment = getPortlessEnvironment({ homeDirectory: homedir(), lanMode });
  const environment = { ...process.env, ...portlessEnvironment };

  // Before Turbo launches apps, so concurrent services never race to initialize shared state.
  startProxy({ currentDirectory, environment });

  const service = { currentDirectory, environment, projectName };
  const mainUrl = getServiceUrl({ ...service, serviceName: "main" });
  const adminUrl = getServiceUrl({ ...service, serviceName: "admin" });
  const apiUrl = getServiceUrl({ ...service, serviceName: "api" });
  const mailboxUrl = getServiceUrl({ ...service, serviceName: "mailbox" });

  const caPath = join(portlessEnvironment.PORTLESS_STATE_DIR, "ca.pem");
  const lanCertificateBundle = lanMode ? trustLanCertificate(caPath) : undefined;

  if (lanMode) {
    process.stdout.write(
      `For LAN browsers and debug apps, install and trust ${caPath} on the device. See the LAN setup in README.md.\n\n`,
    );
  }

  const services: Service[] = sortServices(startedApps).map((name) => ({
    name,
    url: getServiceUrl({ ...service, serviceName: name }),
  }));

  writeAppleDevelopmentConfiguration({ apiUrl, currentDirectory });
  writeAndroidDevelopmentConfiguration({ apiUrl, currentDirectory });
  process.stdout.write(`Starting\n${formatServices(services)}\n\n`);

  const stackEnvironment = {
    ...environment,
    ...(lanCertificateBundle && { NODE_EXTRA_CA_CERTS: lanCertificateBundle }),
    ADMIN_APP_URL: adminUrl,
    MAILBOX_URL: getMailboxCaptureUrl(mailboxUrl),
    MAIN_APP_URL: mainUrl,
    NEXT_PUBLIC_API_URL: apiUrl,
    // Vercel's name for a run on this machine (as in `vercel dev`), so production builds keep local sign-in and mail.
    VERCEL_ENV: "development",
    // Each service stops with this process however it ends; see `stop-with-launcher.mts`.
    ZOONK_DEV_LAUNCHER_PID: String(process.pid),
    ZOONK_DEV_PROJECT: projectName,
  };

  if (productionMode) {
    const build = await buildForProduction({ environment: stackEnvironment, startedApps });

    if (build.code !== 0 || build.signal) {
      return build;
    }
  }

  const stopped = new AbortController();
  void announceWhenReady({ services, signal: stopped.signal });

  try {
    return await runDevelopmentCommand({
      args: productionMode
        ? ["exec", "turbo", "start", "--only", ...filters]
        : ["exec", "turbo", "dev", ...filters],
      environment: stackEnvironment,
    });
  } finally {
    stopped.abort();
  }
}

const startedApps = getStartedApps();

if (startedApps.some((name) => readsDatabase(join(currentDirectory, "apps", name)))) {
  await updateDevelopmentDatabase(realpathSync(currentDirectory));
}

const result =
  !productionMode && (directMode || process.env.PORTLESS === "0")
    ? await startDirectDevelopment()
    : await startPortlessDevelopment(startedApps);

applyCommandExit(result);
