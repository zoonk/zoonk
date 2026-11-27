import { chromium } from "playwright-core";
import { createServer } from "vite";

const server = await createServer({
  configFile: "realui/vite.config.mjs",
  server: { host: "127.0.0.1", hmr: false, watch: null },
});

const viewParams = { act: { k: "timeline" }, activity: { id: "activity-timeline" } };

function params(view, lang) {
  return new URLSearchParams({
    lang,
    view,
    ...(view.startsWith("learner-")
      ? { learner: lang === "pt" ? "ana" : "sat" }
      : viewParams[view]),
  });
}

async function open(page, url, target) {
  const failed = [];
  const onError = (error) => failed.push(error.message);
  page.on("pageerror", onError);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator(target).filter({ visible: true }).first().waitFor({ timeout: 45_000 });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  } catch (error) {
    failed.push(error.message);
  } finally {
    page.off("pageerror", onError);
  }

  if (failed.length > 0) {
    throw new Error(`${url}\n${failed.join("\n")}`);
  }
}

async function render(browser, base) {
  const context = await browser.newContext({ viewport: { height: 844, width: 390 } });

  try {
    await context.route("**/*", (route) =>
      route.request().url().startsWith(base) ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    await open(page, base, "#root > pre");
    const views = (await page.locator("#root > pre").innerText())
      .trim()
      .split("\n")
      .filter(Boolean);

    if (views.length === 0) {
      throw new Error("The studio has no views.");
    }

    for (const lang of ["en", "pt"]) {
      for (const view of views) {
        await open(page, `${base}?${params(view, lang)}`, "#root > *, [role=dialog]");
      }
    }
    console.log(`Rendered ${views.length} studio views in each language.`);
  } finally {
    await context.close();
  }
}

try {
  await server.listen();
  const browser = await chromium.launch(process.env.CI ? { channel: "chrome" } : {});

  try {
    await render(browser, server.resolvedUrls.local[0]);
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
