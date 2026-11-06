// Saves the buddy and Trickster poses from the harness's `art` view as standalone SVGs in assets/svg.
// Run with the harness up: node scripts/export-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const out = fileURLToPath(new URL("../assets/svg/", import.meta.url));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:5199/?view=art", { waitUntil: "networkidle" });
await page.waitForSelector("[data-art] svg");

const art = await page.$$eval("[data-art]", (nodes) => {
  const root = getComputedStyle(document.documentElement);
  return nodes.map((node) => {
    const svg = node.querySelector("svg").cloneNode(true);
    svg.removeAttribute("class");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    // A file has no app stylesheet, so the belt tokens become their values.
    const markup = svg.outerHTML.replaceAll(/var\((--belt-[\w-]+)\)/g, (_, token) =>
      root.getPropertyValue(token).trim(),
    );
    return [node.dataset.art, markup];
  });
});
for (const [name, markup] of art) writeFileSync(`${out}${name}.svg`, markup);
console.log(`wrote ${art.length} SVGs to ${out}`);
await browser.close();
