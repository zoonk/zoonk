/* oxlint-disable no-console -- This CLI prints the pictures it writes. */
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { z } from "zod";

const USAGE = `Usage: pnpm design:sketch <screen.html> [--dark]
       pnpm design:sketch --squint <picture.png>

Draws a screen before it is built. <screen.html> is what goes inside <body>: plain HTML written
with the classes the app's pieces use (it compiles the app's globals.css), and
<i data-lucide="clock" class="size-4"></i> for a Lucide icon. Writes <screen>.png, the screen on
a phone, and <screen>.squint.png, the same picture blurred until no word reads.

  --dark     draw the dark theme (writes <screen>.dark.png and its squint copy)
  --squint   blur an existing screenshot instead, such as a built screen's

Keep the fragment and its pictures outside the repository.`;

const ROOT = resolve(import.meta.dirname, "../..");
const UI = join(ROOT, "packages/ui");
const FONTS = join(ROOT, "apps/apple/Zoonk/Resources/Fonts");
const PHONE = { height: 844, width: 390 };

const TAILWIND_CLI = join(
  dirname(fileURLToPath(import.meta.resolve("@tailwindcss/cli/package.json"))),
  "dist/index.mjs",
);

/** Body text stops reading at this blur of a phone-wide picture while a title's shape stays. */
const SQUINT_SIGMA = 3;

const ICON = /<i\s+data-lucide="(?<name>[a-z0-9-]+)"(?<rest>[^>]*)>\s*<\/i>/gu;

const shapeSchema = z.tuple([z.string(), z.record(z.string(), z.string())]);
const iconSchema = z.object({ __iconData: z.object({ node: z.array(shapeSchema) }) });

const uiRequire = createRequire(join(UI, "package.json"));

async function iconSvg(name: string, className: string): Promise<string> {
  const file = uiRequire.resolve(`lucide-react/icons/${name}`);
  const { __iconData } = iconSchema.parse(await import(pathToFileURL(file).href));

  const shapes = __iconData.node.map(([tag, { key: _key, ...attributes }]) => {
    const text = Object.entries(attributes).map(([attribute, value]) => `${attribute}="${value}"`);
    return `<${tag} ${text.join(" ")}/>`;
  });

  return `<svg class="lucide lucide-${name} ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes.join("")}</svg>`;
}

async function withIcons(fragment: string): Promise<string> {
  const icons = await Promise.all(
    [...fragment.matchAll(ICON)].map(async (match) => ({
      svg: await iconSvg(
        match.groups?.name ?? "",
        /class="(?<value>[^"]*)"/u.exec(match.groups?.rest ?? "")?.groups?.value ?? "size-4",
      ),
      tag: match[0],
    })),
  );

  return icons.reduce((html, { svg, tag }) => html.replace(tag, svg), fragment);
}

/** The app's stylesheet, with the classes the fragment uses. */
async function compileStyles(fragmentPath: string, workDir: string): Promise<string> {
  const input = join(workDir, "in.css");
  const output = join(workDir, "out.css");

  await writeFile(
    input,
    `@import "${join(UI, "src/styles/globals.css")}";\n@source "${fragmentPath}";\n`,
  );

  execFileSync(process.execPath, [TAILWIND_CLI, "-i", input, "-o", output], {
    cwd: UI,
    stdio: ["ignore", "ignore", "inherit"],
  });

  return readFile(output, "utf8");
}

function fontFace(family: string, file: string): string {
  return `@font-face{font-family:"${family}";src:url("${pathToFileURL(join(FONTS, file)).href}");font-weight:100 900;}`;
}

function pageHtml({ body, styles }: { body: string; styles: string }): string {
  return `<!doctype html><html lang="en" style="--font-geist-sans:'Geist';--font-geist-mono:'Geist Mono'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fontFace("Geist", "Geist[wght].ttf")}${fontFace("Geist Mono", "GeistMono[wght].ttf")}</style><style>${styles}</style></head><body class="bg-background text-foreground font-sans antialiased">${body}</body></html>`;
}

async function squint(picture: string): Promise<string> {
  const output = picture.replace(/\.png$/u, ".squint.png");

  await sharp(picture)
    .resize({ width: PHONE.width, withoutEnlargement: true })
    .blur(SQUINT_SIGMA)
    .toFile(output);

  return output;
}

async function drawSketch(fragmentPath: string, dark: boolean): Promise<string> {
  const workDir = await mkdtemp(join(tmpdir(), "zoonk-sketch-"));
  const picture = fragmentPath.replace(/\.html$/u, dark ? ".dark.png" : ".png");

  try {
    const [styles, body] = await Promise.all([
      compileStyles(fragmentPath, workDir),
      readFile(fragmentPath, "utf8").then((fragment) => withIcons(fragment)),
    ]);

    const page = join(workDir, "page.html");
    await writeFile(page, pageHtml({ body, styles }));

    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        colorScheme: dark ? "dark" : "light",
        deviceScaleFactor: 2,
        viewport: PHONE,
      });

      const tab = await context.newPage();
      await tab.goto(pathToFileURL(page).href);
      await tab.evaluate(() => document.fonts.ready);
      await tab.screenshot({ fullPage: true, path: picture });
    } finally {
      await browser.close();
    }
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }

  return picture;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    dark: { default: false, type: "boolean" },
    help: { default: false, type: "boolean" },
    squint: { default: false, type: "boolean" },
  },
});

const [target] = positionals;

if (values.help || target === undefined) {
  console.log(USAGE);
  process.exitCode = values.help ? 0 : 2;
} else if (values.squint) {
  console.log(await squint(resolve(target)));
} else {
  const picture = await drawSketch(resolve(target), values.dark);
  console.log(picture);
  console.log(await squint(picture));
}
