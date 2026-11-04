// Captures the real goal box as the story's goal is typed: node scripts/typing.mjs <lang> [dpr] [chars per frame]
// → assets/real/<lang>/seq/typing/NNN.png + manifest.json (the goal-entry view reads `typed`).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const [lang, dpr = "3", step = "2"] = process.argv.slice(2);
const view = `http://localhost:5199/?view=goal-entry&lang=${lang}`;
const out = fileURLToPath(new URL(`../assets/real/${lang}/seq/typing/`, import.meta.url));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
});
const page = await (
  await browser.newContext({
    viewport: { width: 390, height: 794 },
    deviceScaleFactor: +dpr,
    reducedMotion: "reduce",
  })
).newPage();
await page.goto(view, { waitUntil: "networkidle" });
const total = await page.$eval("textarea", (e) => e.value.length);

const counts = [];
for (let n = 0; n <= total; n += +step) counts.push(n);
if (counts.at(-1) !== total) counts.push(total);

const frames = [];
for (const [i, n] of counts.entries()) {
  await page.goto(`${view}&typed=${n}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const f = `${String(i).padStart(3, "0")}.png`;
  await page.screenshot({ path: out + f });
  frames.push({ f, label: String(n), hold: 1, chars: n });
}
writeFileSync(out + "manifest.json", JSON.stringify({ frames, errors: [] }, null, 1));
console.log(lang, frames.length, "frames");
await browser.close();
