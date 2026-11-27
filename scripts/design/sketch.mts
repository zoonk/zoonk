/* oxlint-disable no-console -- This CLI prints the pictures it writes. */
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { type Page, chromium } from "@playwright/test";
import sharp from "sharp";
import { z } from "zod";

const USAGE = `Usage: pnpm design:sketch <screen.html> [--dark]
       pnpm design:sketch --squint <picture.png>

Draws a screen before it is built. <screen.html> is what goes inside <body>: plain HTML written
with the classes the app's pieces use (it compiles the app's globals.css), and
<i data-lucide="clock" class="size-4"></i> for a Lucide icon. Writes <screen>.png, what a phone
shows of it (390 by 844, at 2x), and <screen>.squint.png, the same picture blurred until its body
text can't be read.

  --dark     draw the dark theme (writes <screen>.dark.png and its squint copy)
  --squint   blur an existing screenshot instead, such as a built screen's

Keep the fragment and its pictures outside the repository. It draws with the Chromium the E2E
tests use: pnpm exec playwright install chromium.`;

const ROOT = resolve(import.meta.dirname, "../..");
const UI = join(ROOT, "packages/ui");
const FONTS = join(ROOT, "apps/apple/Zoonk/Resources/Fonts");
const PHONE = { height: 844, width: 390 };

const TAILWIND_CLI = join(
  dirname(fileURLToPath(import.meta.resolve("@tailwindcss/cli/package.json"))),
  "dist/index.mjs",
);

/** Body text stops reading at this blur of a phone-wide picture, while a title keeps its shape. */
const SQUINT_SIGMA = 3;

const shapeSchema = z.tuple([z.string(), z.record(z.string(), z.string())]);

const iconSchema = z
  .object({ __iconData: z.object({ node: z.array(shapeSchema) }) })
  .transform(({ __iconData: icon }) => icon.node);

const uiRequire = createRequire(join(UI, "package.json"));

type Shape = z.infer<typeof shapeSchema>;

async function iconShapes(name: string): Promise<Shape[]> {
  const file = uiRequire.resolve(`lucide-react/icons/${name}`);

  return iconSchema.parse(await import(pathToFileURL(file).href));
}

/** Each `<i data-lucide>` becomes its icon, drawn as `lucide-react` draws it, with the mark's classes. */
async function drawIcons(tab: Page) {
  const names = await tab.$$eval("i[data-lucide]", (marks) =>
    marks.map((mark) => mark.dataset.lucide ?? ""),
  );

  const entries = await Promise.all(
    [...new Set(names)].map(async (name) => [name, await iconShapes(name)] as const),
  );

  const shapes: Record<string, Shape[]> = Object.fromEntries(entries);

  await tab.$$eval(
    "i[data-lucide]",
    (marks, shapesByName: Record<string, Shape[]>) => {
      const svg = "http://www.w3.org/2000/svg";

      const look = {
        "aria-hidden": "true",
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-width": "2",
        viewBox: "0 0 24 24",
      };

      for (const mark of marks) {
        const name = mark.dataset.lucide ?? "";
        const icon = document.createElementNS(svg, "svg");
        icon.setAttribute("class", `lucide lucide-${name} ${mark.getAttribute("class") ?? ""}`);

        for (const [attribute, value] of Object.entries(look)) {
          icon.setAttribute(attribute, value);
        }

        for (const [tag, attributes] of shapesByName[name] ?? []) {
          const shape = document.createElementNS(svg, tag);

          for (const [attribute, value] of Object.entries(attributes)) {
            if (attribute !== "key") {
              shape.setAttribute(attribute, value);
            }
          }

          icon.append(shape);
        }

        mark.replaceWith(icon);
      }
    },
    shapes,
  );
}

/** The app's stylesheet with the classes the fragment uses, read from a copy so its name never reaches the CSS. */
async function compileStyles(fragmentPath: string, workDir: string): Promise<string> {
  const input = join(workDir, "in.css");
  const output = join(workDir, "out.css");

  await copyFile(fragmentPath, join(workDir, "fragment.html"));

  await writeFile(
    input,
    `@import "${join(UI, "src/styles/globals.css")}";\n@source "./fragment.html";\n`,
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

/** The fragment's own folder is the page's base, so a picture beside it loads. */
function pageHtml({ base, body, styles }: { base: string; body: string; styles: string }): string {
  return `<!doctype html><html lang="en" style="--font-geist-sans:'Geist';--font-geist-mono:'Geist Mono'"><head><meta charset="utf-8"><base href="${base}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fontFace("Geist", "Geist[wght].ttf")}${fontFace("Geist Mono", "GeistMono[wght].ttf")}</style><style>${styles}</style></head><body class="bg-background text-foreground font-sans antialiased">${body}</body></html>`;
}

function withoutExtension(path: string): string {
  return path.slice(0, path.length - extname(path).length);
}

async function squint(picture: string): Promise<string> {
  const output = `${withoutExtension(picture)}.squint.png`;

  await sharp(picture)
    .resize({ width: PHONE.width, withoutEnlargement: true })
    .blur(SQUINT_SIGMA)
    .toFile(output);

  return output;
}

async function drawSketch(fragmentPath: string, dark: boolean): Promise<string> {
  const workDir = await mkdtemp(join(tmpdir(), "zoonk-sketch-"));
  const picture = `${withoutExtension(fragmentPath)}${dark ? ".dark" : ""}.png`;

  try {
    const [styles, body] = await Promise.all([
      compileStyles(fragmentPath, workDir),
      readFile(fragmentPath, "utf8"),
    ]);

    const page = join(workDir, "page.html");
    await writeFile(page, pageHtml({ base: pathToFileURL(fragmentPath).href, body, styles }));

    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        colorScheme: dark ? "dark" : "light",
        deviceScaleFactor: 2,
        viewport: PHONE,
      });

      const tab = await context.newPage();
      await tab.goto(pathToFileURL(page).href);
      await drawIcons(tab);
      await tab.evaluate(() => document.fonts.ready);
      await tab.screenshot({ path: picture });

      const height = await tab.evaluate(() => document.documentElement.scrollHeight);

      if (height > PHONE.height) {
        console.log(`The screen is ${height}px tall: the picture is its first ${PHONE.height}px.`);
      }
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
const expected = values.squint ? ".png" : ".html";

if (values.help || target === undefined) {
  console.log(USAGE);
  process.exitCode = values.help ? 0 : 2;
} else if (extname(target).toLowerCase() !== expected) {
  console.error(
    values.squint
      ? `--squint takes a .png picture, not ${target}.`
      : `A sketch is a .html fragment, not ${target}. To blur a picture, pass --squint.`,
  );

  process.exitCode = 2;
} else if (values.squint) {
  console.log(await squint(resolve(target)));
} else {
  const picture = await drawSketch(resolve(target), values.dark);
  console.log(picture);
  console.log(await squint(picture));
}
