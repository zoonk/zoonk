import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
// Renders an HTML timeline page to video, frame by frame.
// The page exposes window.__ready (Promise), window.__duration (s) and window.__seek(t).
// Usage: node scripts/render.mjs --page films/zoonk-2/long.html --query lang=en --w 1920 --h 1080 --dpr 2 --fps 60 \
//          --workers 6 --audio films/zoonk-2/audio/mix-long-en.wav --out out/en-US/youtube.mp4
//        node scripts/render.mjs --page films/zoonk-2/long.html --query lang=pt --stills all --every 2 --outdir out/stills
// Vertical: --w 1080 --h 1920 --dpr 2 --outw 1080 --outh 1920 renders at 2x and downscales with lanczos.
// A stage scene: --url "<harness>/stage/?film=launch&scene=clip&lang=en" --scheme dark renders it on black.
// A stage scene is checked at every frame first, and a frame that cuts what it shows fails the render.
import { chromium } from "playwright-core";
import { pinStoryClock } from "./story-clock.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--"))
      acc.push([
        a.slice(2),
        arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? "1" : arr[i + 1],
      ]);
    return acc;
  }, []),
);
const W = +(args.w ?? 1920);
const H = +(args.h ?? 1080);
const DPR = +(args.dpr ?? 1);
const FPS = +(args.fps ?? 30);
const WORKERS = +(args.workers ?? 4);
const pageUrl =
  args.url ?? pathToFileURL(path.resolve(args.page)).href + (args.query ? `?${args.query}` : "");

async function openPage() {
  const browser = await chromium.launch({
    args: [
      "--force-color-profile=srgb",
      "--disable-lcd-text",
      "--font-render-hinting=none",
      "--hide-scrollbars",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: DPR,
    reducedMotion: "reduce",
    colorScheme: args.scheme ?? "light",
  });
  await pinStoryClock(ctx);
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.error("[page]", m.text());
  });
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => window.__ready);
  const cdp = await ctx.newCDPSession(page);
  const duration = await page.evaluate(() => window.__duration);
  return { browser, page, cdp, duration };
}

async function grab(cdp, format = "png") {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format,
    ...(format === "jpeg" ? { quality: 96 } : {}),
    optimizeForSpeed: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: W, height: H, scale: DPR },
  });
  return Buffer.from(data, "base64");
}

async function seek(page, t) {
  await page.evaluate(async (tt) => {
    window.__seek(tt);
    const shown = [...document.images].filter((i) =>
      i.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }),
    );
    await Promise.all(shown.map((i) => i.decode().catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, t);
}

/**
 * A stage scene checks each moment it will show (stage.cuts): a frame that slices what it shows fails the
 * render before anything is written. Pages made with the engine have no check.
 */
async function failOnCuts(page, times) {
  const cuts = await page.evaluate(
    (all) =>
      window.__cuts
        ? all.flatMap((t) => {
            window.__seek(t);
            return window.__cuts().map((cut) => `${t.toFixed(2)} s: ${cut}`);
          })
        : [],
    times,
  );
  if (cuts.length > 0)
    throw new Error(
      `The frame cuts what it shows in ${cuts.length} places:\n${cuts.slice(0, 12).join("\n")}`,
    );
}

if (args.stills) {
  const outdir = args.outdir ?? "out/stills";
  const { browser, page, cdp, duration } = await openPage();
  mkdirSync(outdir, { recursive: true });
  const times =
    args.stills === "all"
      ? Array.from(
          { length: Math.ceil(duration / +(args.every ?? 2)) },
          (_, i) => i * +(args.every ?? 2),
        )
      : args.stills.split(",").map(Number);
  await failOnCuts(page, times);
  for (const t of times) {
    await seek(page, t);
    const buf = await grab(cdp, "png");
    const f = path.join(outdir, `${args.prefix ?? "s"}-${t.toFixed(2).padStart(7, "0")}.png`);
    writeFileSync(f, buf);
  }
  console.log(`duration ${duration.toFixed(2)}s, wrote ${times.length} stills to ${outdir}`);
  await browser.close();
  process.exit(0);
}

const out = args.out ?? "out/video.mp4";
const probe = await openPage();
const duration = args.to ? +args.to : probe.duration;
const from = +(args.from ?? 0);
const totalFrames = Math.round((duration - from) * FPS);
try {
  await failOnCuts(
    probe.page,
    Array.from({ length: totalFrames }, (_, f) => from + f / FPS),
  );
} finally {
  await probe.browser.close();
}
// Each run has its own segments folder, removed whether it succeeds or not, so two renders never share one.
const segDir = mkdtempSync(path.join(tmpdir(), "zoonk-render-"));
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const per = Math.ceil(totalFrames / WORKERS);
const started = Date.now();
let done = 0;

const encArgs = (file) => [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "image2pipe",
  "-framerate",
  String(FPS),
  "-c:v",
  args.jpeg ? "mjpeg" : "png",
  "-i",
  "-",
  "-vf",
  `${args.outw ? `scale=${args.outw}:${args.outh}:flags=lanczos,` : ""}scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv`,
  "-c:v",
  "libx264",
  "-preset",
  args.preset ?? "slow",
  "-crf",
  args.crf ?? "14",
  "-profile:v",
  "high",
  "-g",
  String(Math.round(FPS / 2)),
  "-bf",
  "2",
  "-flags",
  "+cgop",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-color_range",
  "tv",
  "-r",
  String(FPS),
  "-movflags",
  "+faststart",
  file,
];

async function worker(i) {
  const a = i * per;
  const b = Math.min(totalFrames, a + per);
  if (a >= b) return null;
  const file = path.join(segDir, `seg-${String(i).padStart(3, "0")}.mp4`);
  const { browser, page, cdp } = await openPage();
  const ff = spawn("ffmpeg", encArgs(file), { stdio: ["pipe", "inherit", "inherit"] });
  for (let f = a; f < b; f++) {
    await seek(page, from + f / FPS);
    const buf = await grab(cdp, args.jpeg ? "jpeg" : "png");
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    done++;
    if (done % 60 === 0) {
      const el = (Date.now() - started) / 1000;
      process.stdout.write(
        `\r${done}/${totalFrames} frames, ${(done / el).toFixed(1)} fps, eta ${((totalFrames - done) / (done / el)).toFixed(0)}s   `,
      );
    }
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on("close", (c) => (c === 0 ? r() : j(new Error(`ffmpeg ${c}`)))));
  await browser.close();
  return file;
}

try {
  const files = (await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)))).filter(
    Boolean,
  );
  writeFileSync(
    path.join(segDir, "list.txt"),
    files.map((f) => `file '${path.resolve(f)}'`).join("\n"),
  );
  const concatArgs = [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    path.join(segDir, "list.txt"),
  ];
  if (args.audio)
    concatArgs.push(
      "-ss",
      String(from),
      "-i",
      args.audio,
      "-map",
      "0:v",
      "-map",
      "1:a",
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-ar",
      "48000",
      "-shortest",
    );
  concatArgs.push("-c:v", "copy", "-movflags", "+faststart", out);
  await new Promise((r, j) =>
    spawn("ffmpeg", concatArgs, { stdio: "inherit" }).on("close", (c) =>
      c === 0 ? r() : j(new Error(`concat ${c}`)),
    ),
  );
} finally {
  rmSync(segDir, { force: true, recursive: true });
}
console.log(
  `\nwrote ${out} (${totalFrames} frames) in ${((Date.now() - started) / 1000).toFixed(0)}s`,
);
