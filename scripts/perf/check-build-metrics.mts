/* oxlint-disable no-console -- This CLI emits build measurements and GitHub warning annotations. */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

/**
 * Trends only: CI hardware and cold caches make these unsuitable for a PR gate. A warm build of
 * Main and the API fits the time, and one over it pushes E2E's build job toward its target.
 */
const MAX_SECONDS = 180;
const MAX_RSS_GIB = 8;
const MAX_RSS_KIB = MAX_RSS_GIB * 1024 * 1024;
const { values } = parseArgs({ options: { metrics: { type: "string" } } });

try {
  if (!values.metrics) {
    throw new Error("Missing --metrics GNU time output file.");
  }

  const output = await readFile(values.metrics, "utf8");

  const elapsed = /Elapsed \(wall clock\) time \(h:mm:ss or m:ss\):\s*(?<elapsed>[\d:.]+)/u.exec(
    output,
  )?.groups?.elapsed;

  const rss = /Maximum resident set size \(kbytes\):\s*(?<rss>\d+)/u.exec(output)?.groups?.rss;

  if (!elapsed || !rss) {
    throw new Error("Build timing did not contain elapsed/RSS fields.");
  }

  const seconds = elapsed.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  const rssKiB = Number(rss);

  console.log(`E2E build: ${seconds.toFixed(2)} s; maximum RSS ${(rssKiB / 1024).toFixed(0)} MiB.`);

  if (seconds > MAX_SECONDS) {
    console.log(
      `::warning title=E2E build time::${seconds.toFixed(2)} s exceeds the ${MAX_SECONDS} s trend budget.`,
    );
  }

  if (rssKiB > MAX_RSS_KIB) {
    console.log(
      `::warning title=E2E build RSS::${rssKiB} KiB exceeds the ${MAX_RSS_KIB} KiB trend budget.`,
    );
  }
} catch (error) {
  console.log(
    `::warning title=E2E build metrics::${error instanceof Error ? error.message : String(error)}`,
  );
}
