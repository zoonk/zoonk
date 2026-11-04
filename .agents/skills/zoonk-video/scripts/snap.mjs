// Captures a film's real-screen stills from the harness at 3x: node scripts/snap.mjs <film>/stills.json [name...]
// stills.json maps each still to its view query, or to { "query", "langs" } when only some languages need it.
// → assets/real/<lang>/<name>.png
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const [list, ...only] = process.argv.slice(2);
const stills = Object.entries(JSON.parse(readFileSync(list, "utf8"))).filter(
  ([name]) => !only.length || only.includes(name),
);
const settle = Number(process.env.SETTLE ?? 1000);

const browser = await chromium.launch({
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 794 },
  deviceScaleFactor: 3,
  reducedMotion: "reduce",
  colorScheme: "light",
  hasTouch: true,
});
const page = await context.newPage();
let errors = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().split("\n")[0]));

for (const [name, entry] of stills) {
  const { query, langs = ["en", "pt"] } = typeof entry === "string" ? { query: entry } : entry;
  for (const lang of langs) {
    const out = fileURLToPath(new URL(`../assets/real/${lang}/`, import.meta.url));
    mkdirSync(out, { recursive: true });
    errors = [];
    await page.goto(`http://localhost:5199/?${query}&lang=${lang}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `${out}${name}.png` });
    console.log(
      `${lang}/${name}${errors.length ? `  errors: ${errors.slice(0, 3).join(" | ")}` : ""}`,
    );
  }
}
await browser.close();
