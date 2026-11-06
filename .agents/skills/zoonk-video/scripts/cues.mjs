import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
// Writes a page's duration and sound cues (Z.sfx) for mix.py:
// node scripts/cues.mjs films/zoonk-2/long.html 1920 1080 films/zoonk-2/audio/cues-long-en.json lang=en
import { chromium } from "playwright-core";
const [page, w, h, out, query = ""] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
await p.goto(pathToFileURL(path.resolve(page)).href + (query ? `?${query}` : ""));
await p.evaluate(() => window.__ready);
const data = await p.evaluate(() => ({ duration: window.__duration, cues: window.__cues }));
writeFileSync(out, JSON.stringify(data));
console.log(data.duration, data.cues.length, [...new Set(data.cues.map((c) => c.name))].join(","));
await b.close();
