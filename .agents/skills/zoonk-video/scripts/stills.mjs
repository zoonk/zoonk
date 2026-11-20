// Social stills from a film's stage scenes, in every size, scheme and language, with the harness running:
//   node scripts/stills.mjs --film launch --scenes goal,time,today,goal-angle --out out/launch
// Writes <out>/<lang>/<scene>-<16x9|4x5>-<light|black>.png, rendered at 2x and reduced with lanczos.
// Narrow it with --langs en, --formats 16x9, --schemes dark. Every image is captured before any is
// written, so a name the stage doesn't know fails the run with nothing saved.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { HARNESS } from "./harness.mjs";
import { pinStoryClock } from "./story-clock.mjs";

const SIZES = { "16x9": [1600, 900], "4x5": [1080, 1350] };
const NAMES = { light: "light", dark: "black" };
const PARALLEL = 4;

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .flatMap((arg, i, all) => (arg.startsWith("--") ? [[arg.slice(2), all[i + 1]]] : [])),
);
const list = (value, fallback) => (value ?? fallback).split(",");
if (!args.film || !args.scenes || !args.out) {
  throw new Error("usage: node scripts/stills.mjs --film <film> --scenes <a,b> --out <dir>");
}

for (const [flag, value, allowed] of [
  ["formats", list(args.formats, "16x9,4x5"), Object.keys(SIZES)],
  ["schemes", list(args.schemes, "light,dark"), Object.keys(NAMES)],
]) {
  const unknown = value.filter((name) => !allowed.includes(name));
  if (unknown.length > 0)
    throw new Error(`--${flag} ${unknown.join(",")}: use ${allowed.join(", ")}`);
}

const jobs = list(args.langs, "en,pt").flatMap((lang) =>
  list(args.scenes).flatMap((scene) =>
    list(args.formats, "16x9,4x5").flatMap((fmt) =>
      list(args.schemes, "light,dark").map((scheme) => ({ fmt, lang, scene, scheme })),
    ),
  ),
);

const browser = await chromium.launch({
  args: [
    "--force-color-profile=srgb",
    "--disable-lcd-text",
    "--font-render-hinting=none",
    "--hide-scrollbars",
  ],
});

async function shoot({ fmt, lang, scene, scheme }) {
  const [width, height] = SIZES[fmt];
  const context = await browser.newContext({
    colorScheme: scheme,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    viewport: { width, height },
  });
  await pinStoryClock(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error(`[${scene} ${lang}]`, error.message));
  await page.goto(`${HARNESS}/stage/?film=${args.film}&scene=${scene}&fmt=${fmt}&lang=${lang}`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(400);
  const png = await page.screenshot();
  await context.close();
  return {
    out: path.join(args.out, lang, `${scene}-${fmt}-${NAMES[scheme]}.png`),
    png,
    width,
    height,
  };
}

function save({ out, png, width, height }) {
  mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", "-", "-vf", `scale=${width}:${height}:flags=lanczos`, out],
    { input: png },
  );
  console.log(out);
}

const started = Date.now();
const queue = [...jobs];
const shots = [];
try {
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) shots.push(await shoot(job));
    }),
  );
} finally {
  await browser.close();
}
shots.forEach(save);
console.log(`${jobs.length} stills in ${((Date.now() - started) / 1000).toFixed(0)}s`);
