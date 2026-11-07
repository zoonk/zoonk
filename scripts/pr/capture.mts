/* oxlint-disable no-console -- This CLI prints where the capture went and how to attach it. */
import { writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { assertBrowserLaunchAllowed } from "../../packages/testing/src/browser-preflight.ts";
import { getMailboxCaptureUrl, getServiceUrl } from "../dev/config.mts";
import { signIn } from "../verify/sign-in.mts";
import { SCHEMES, VIEWPORT_NAMES, pick } from "../verify/viewports.mts";
import { compareSides, describeChange } from "./compare.mts";
import { SIDES, readCapture, renderMedia } from "./media.mts";
import { type Steps, captureSide, visitPaths } from "./record.mts";

const repository = resolve(import.meta.dirname, "../..");

const USAGE = `Usage: pnpm pr:capture <before|after> <path...> [options]
       pnpm pr:capture <before|after> --steps <file> [options]

Captures Main the same way on each side of a change and writes tmp/pr-media/media.md, the PR's
before-and-after section. zoonk-commit's "Show the change" says when and how.

  --email <address>   sign in as this learner, with the newest code in the dev mailbox
  --steps <file>      run the file's default export, async ({ page, shot }) => {...}, instead of
                      visiting paths; shot(name, { settle: false }) shoots without waiting
  --video             also record each screen while it runs
  --viewports <list>  phone,laptop by default (${VIEWPORT_NAMES.join(", ")})
  --schemes <list>    light by default (light, dark)
  --url <url>         Main's URL, this checkout's by default
  --out <dir>         tmp/pr-media by default`;

function readArguments() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
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
    values.url ?? getServiceUrl({ currentDirectory: repository, serviceName: "main" });

  const steps = values.steps ? await readSteps(values.steps) : visitPaths(paths);

  const storageState = values.email
    ? await signIn({
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
    out,
    schemes: pick(values.schemes, SCHEMES, "scheme"),
    side,
    steps,
    storageState,
    video: values.video,
    viewports: pick(values.viewports, VIEWPORT_NAMES, "viewport"),
  }).finally(async () => browser.close());

  const [before, after] = await Promise.all(
    SIDES.map(async (name) => readCapture(join(out, name))),
  );

  const sides = { after, before };
  const changes = await compareSides(out, sides);
  const unchanged = new Set(changes.filter(({ change }) => !change.box).map(({ row }) => row));
  const media = renderMedia({ root: relative(repository, out), sides, unchanged });
  await writeFile(join(out, "media.md"), `${media.markdown}\n`);

  console.log(
    [
      `${side}: ${items.length} files from ${baseUrl} in ${relative(repository, join(out, side))}`,
      ...(changes.length > 0
        ? ["What changed in each pair:", ...changes.map((change) => `  ${describeChange(change)}`)]
        : []),
      `Before-and-after section: ${relative(repository, join(out, "media.md"))}${before && after ? "" : " (one side so far)"}`,
      "Rewrite each panel's summary to say what changed there. Put the section in the PR body, and pass every file it links to gh pr create or gh pr edit, run from the repository root:",
      media.attachments.map((file) => `--attach ${file}`).join(" "),
    ].join("\n"),
  );
}

const parsed = readArguments();

if (parsed.values.help) {
  console.log(USAGE);
} else {
  await capture(parsed);
}
