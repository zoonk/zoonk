import { mkdirSync, rmSync, writeFileSync } from "node:fs";
// Captures real interactions in the real-UI renderer as numbered frames plus a manifest.
// node scripts/seq.mjs <scenario> <lang> [dpr]   → assets/real/<lang>/seq/<scenario>/NNN.png + manifest.json
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { pinStoryClock } from "./story-clock.mjs";

const [name, lang = "en", dpr = "3"] = process.argv.slice(2);
const pt = lang === "pt";
const out = fileURLToPath(new URL(`../assets/real/${lang}/seq/${name}/`, import.meta.url));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const b = await chromium.launch({
  args: [
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const ctx = await b.newContext({
  viewport: { width: 390, height: 794 },
  deviceScaleFactor: +dpr,
  reducedMotion: "no-preference",
  colorScheme: "light",
});
await pinStoryClock(ctx);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const frames = [];
let n = 0;
async function shot(label = "", hold = 1) {
  const f = `${String(n++).padStart(3, "0")}.png`;
  await page.screenshot({ path: out + f });
  frames.push({ f, label, hold });
}
const wait = (ms) => page.waitForTimeout(ms);
async function open(query) {
  await page.goto(`http://localhost:5199/?${query}&lang=${lang}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await wait(900);
}
async function drag(locator, to, steps = 14, every = 1) {
  const box = await locator.boundingBox();
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = 1 - (1 - k) ** 3;
    await page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
    await wait(30);
    if (i % every === 0) await shot("drag");
  }
  await page.mouse.up();
  await wait(500);
}

const scenarios = {
  async timeline() {
    await open("view=act&k=timeline");
    await shot("start", 3);
    const chip = page.getByText(pt ? "Chegada do homem à Lua" : "Moon landing").first();
    const end = page.getByText(pt ? "2000 d.C." : "2000 CE").first();
    const eb = await end.boundingBox();
    await drag(chip, { x: eb.x + eb.width + 120, y: eb.y + eb.height / 2 - 3 }, 14);
    await shot("dropped", 4);
  },
  async map() {
    await open("view=act&k=map");
    await shot("start", 3);
    const pins = page.locator("svg [role=button], button").filter({ hasText: /^1$/ });
    const pin = (await pins.count()) ? pins.first() : page.getByText("1", { exact: true }).first();
    await pin.click();
    await wait(700);
    await shot("revealed", 4);
    const pin2 = page.getByText("2", { exact: true }).first();
    await pin2.click().catch(() => {});
    await wait(700);
    await shot("revealed2", 4);
  },
  async projectile() {
    await open("view=act&k=projectile");
    await shot("start", 3);
    const slider = page.getByRole("slider").first();
    await slider.focus();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("ArrowRight");
      await wait(25);
      await shot("move");
    }
    await wait(300);
    await shot("end", 4);
  },
  async polls() {
    await open("view=act&k=polls");
    await shot("start", 3);
    const run = page.getByRole("button", { name: pt ? /Executar de novo/ : /Run again/ }).first();
    await run.click();
    for (let i = 0; i < 16; i++) {
      await wait(150);
      await shot("run");
    }
    await page
      .waitForFunction(() => document.querySelectorAll("svg rect").length > 10, null, {
        timeout: 15000,
      })
      .catch(() => {});
    await wait(1500);
    await shot("end", 4);
  },
  async code() {
    await open("view=act&k=code");
    await shot("start", 3);
    const line = page.getByRole("textbox").first();
    await line.click();
    await page.keyboard.press("End");
    for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Backspace");
    await shot("edit", 1);
    await page.keyboard.type("1", { delay: 60 });
    await shot("edit2", 2);
    await page
      .getByRole("button", { name: pt ? /^Executar$/ : /^Run$/ })
      .first()
      .click();
    for (let i = 0; i < 25; i++) {
      await wait(200);
      const done = await page.getByText("5050").count();
      if (done > 1) break;
    }
    await wait(400);
    await shot("ran", 4);
  },
  async piano() {
    await open("view=act&k=piano");
    await shot("start", 3);
    await page
      .getByRole("button", { name: pt ? /Reproduzir o som/ : /Play the sound/ })
      .first()
      .click()
      .catch(() => {});
    await wait(500);
    await shot("played", 2);
    await page
      .getByText(pt ? "Um acorde menor" : "A minor chord")
      .first()
      .click();
    await wait(300);
    await shot("picked", 2);
    await page.getByRole("button", { name: pt ? "Conferir" : "Check" }).click();
    await wait(900);
    await shot("checked", 4);
  },
  async averages() {
    await open("view=averages");
    await shot("start", 3);
    await page
      .getByText(pt ? "A média" : "The average (mean)")
      .first()
      .click();
    await wait(250);
    await shot("picked", 2);
    await page.getByRole("button", { name: pt ? "Conferir" : "Check" }).click();
    await wait(1100);
    await shot("wrong", 4);
  },
  async tutor() {
    await open("view=tutor");
    await page
      .getByText(pt ? "A média" : "The average (mean)")
      .first()
      .click();
    await page.getByRole("button", { name: pt ? "Conferir" : "Check" }).click();
    await wait(1100);
    await shot("wrong", 3);
    await page
      .getByRole("button", { name: pt ? /Pergunte para Zu|Zu/ : /Ask Zu/ })
      .first()
      .click();
    await wait(1000);
    await shot("sheet", 3);
    const chip = page
      .getByRole("button", {
        name: pt ? /Explique de um jeito mais simples/ : /Explain it more simply/,
      })
      .first();
    await chip.click();
    for (let i = 0; i < 24; i++) {
      await wait(160);
      await shot("stream");
    }
    await wait(1200);
    await shot("answered", 4);
  },
  async complete() {
    await open("view=complete");
    await page
      .getByText(pt ? "A mediana" : "The median")
      .first()
      .click();
    await page.getByRole("button", { name: pt ? "Conferir" : "Check" }).click();
    await wait(900);
    await shot("right", 2);
    await page
      .getByRole("button", { name: pt ? /^Continuar/ : /^Continue/ })
      .first()
      .click();
    for (let i = 0; i < 20; i++) {
      await wait(150);
      await shot("done");
    }
    await wait(1500);
    await shot("end", 4);
  },
  async word() {
    await open("view=word");
    await shot("start", 4);
  },
};

await scenarios[name]();
writeFileSync(out + "manifest.json", JSON.stringify({ frames, errors }, null, 1));
console.log(
  name,
  lang,
  frames.length,
  "frames",
  errors.length ? `errors: ${errors.slice(0, 3).join(" | ")}` : "",
);
await b.close();
