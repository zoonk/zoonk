/* oxlint-disable no-console -- This CLI prints where the capture went and how to attach it. */
import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { assertBrowserLaunchAllowed } from "../../packages/testing/src/browser-preflight.ts";
import { getMailboxCaptureUrl, getServiceUrl } from "../dev/config.mts";
import { signIn } from "../verify/sign-in.mts";
import { SCHEMES, VIEWPORT_NAMES, pick } from "../verify/viewports.mts";
import { SIDES, buildOf } from "./media.mts";
import { readCheckoutBuild, sha256Text } from "./provenance.mts";
import { type Steps, captureSide, visitPaths } from "./record.mts";
import { writeSection } from "./section.mts";

const repository = resolve(import.meta.dirname, "../..");

const USAGE = `Usage: pnpm pr:capture <before|after> <path...> [options]
       pnpm pr:capture <before|after> --steps <file> [options]

Captures an app the same way on each side of a change and writes tmp/pr-media/media.md, the PR's
before-and-after section, once pnpm pr:media check passes on every file it links: an after
picture needs this checkout's current build from pnpm start and a read (pnpm pr:media tiles,
then pnpm pr:media read). Each shot's layout is measured on the page as shot, by the alignment
checks, into the side's alignment.json; the check fails an after side on what they leave
unresolved. zoonk-commit's "Show the change" says when and how.

  --email <address>   sign in as this learner, with the newest code in the dev mailbox
  --steps <file>      run the file's default export, async ({ page, shot }) => {...}, instead of
                      visiting paths; shot(name, { settle: false }) shoots without waiting
  --video             also record each screen while it runs
  --viewports <list>  phone,laptop by default (${VIEWPORT_NAMES.join(", ")})
  --schemes <list>    light by default (light, dark)
  --app <name>        the app to capture: main by default, or another such as api or admin
  --url <url>         the app's URL, this checkout's by default
  --out <dir>         tmp/pr-media by default`;

function readArguments() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        app: { default: "main", type: "string" },
        email: { type: "string" },
        help: { default: false, short: "h", type: "boolean" },
        out: { default: join(repository, "tmp/pr-media"), type: "string" },
        schemes: { default: "light", type: "string" },
        steps: { type: "string" },
        url: { type: "string" },
        video: { default: false, type: "boolean" },
        viewports: { default: "phone,laptop", type: "string" },
      },
    });
  } catch (error) {
    throw new Error(`${String(error)}\n\n${USAGE}`, { cause: error });
  }
}

async function readSteps(file: string): Promise<Steps> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Checked below.
  const imported = (await import(pathToFileURL(resolve(file)).href)) as { default?: unknown };

  if (typeof imported.default !== "function") {
    throw new TypeError(`${file} must export a default async function ({ page, shot }).`);
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The agent's own steps module.
  return imported.default as Steps;
}

async function capture({ positionals, values }: ReturnType<typeof readArguments>) {
  const [sideName, ...paths] = positionals;
  const side = SIDES.find((name) => name === sideName);

  if (!side || paths.length > 0 === Boolean(values.steps)) {
    throw new Error(`Name a side, then paths or --steps, not both.\n\n${USAGE}`);
  }

  assertBrowserLaunchAllowed();

  const out = resolve(values.out);

  const baseUrl =
    values.url ?? getServiceUrl({ currentDirectory: repository, serviceName: values.app });

  const steps = values.steps ? await readSteps(values.steps) : visitPaths(paths);

  const stepsDigest = sha256Text(
    values.steps ? await readFile(values.steps, "utf8") : JSON.stringify(paths),
  );

  const checkout = await readCheckoutBuild({ app: values.app, repository });

  const signedIn = values.email
    ? await signIn({
        app: values.app,
        baseUrl,
        email: values.email,
        mailboxUrl: getMailboxCaptureUrl(
          getServiceUrl({ currentDirectory: repository, serviceName: "mailbox" }),
        ),
      })
    : undefined;

  const browser = await chromium.launch();

  const items = await captureSide({
    baseUrl,
    browser,
    checkout,
    out,
    schemes: pick(values.schemes, SCHEMES, "scheme"),
    side,
    steps,
    stepsDigest,
    storageState: signedIn?.storageState,
    video: values.video,
    viewports: pick(values.viewports, VIEWPORT_NAMES, "viewport"),
  }).finally(async () => browser.close());

  const unbound = items.filter((item) => buildOf(item).id === "unknown").length;
  const { report, written } = await writeSection({ out, repository });

  console.log(
    [
      `${side}: ${items.length} files from ${baseUrl} in ${relative(repository, join(out, side))}`,
      unbound > 0 &&
        `${unbound} of them came from a server that isn't this checkout's current ${values.app} build, so their build is unknown.`,
      report,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (!written) {
    process.exitCode = 1;
  }
}

const parsed = readArguments();

if (parsed.values.help) {
  console.log(USAGE);
} else {
  await capture(parsed);
}
