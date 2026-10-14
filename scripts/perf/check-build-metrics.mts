/* oxlint-disable no-console -- This CLI emits build measurements and GitHub warning annotations. */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

/** Trends only: CI hardware and warm caches make these unsuitable for a PR gate. */
const MAX_SECONDS = 60;
const MAX_RSS_GIB = 6;
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
    throw new Error("Build timing did not contain GNU time elapsed/RSS fields.");
  }

  const seconds = elapsed.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  const rssKiB = Number(rss);

  console.log(
    `Main build: ${seconds.toFixed(2)} s; maximum RSS ${(rssKiB / 1024).toFixed(0)} MiB.`,
  );

  if (seconds > MAX_SECONDS) {
    console.log(
      `::warning title=Main build time::${seconds.toFixed(2)} s exceeds the ${MAX_SECONDS} s trend budget.`,
    );
  }

  if (rssKiB > MAX_RSS_KIB) {
    console.log(
      `::warning title=Main build RSS::${rssKiB} KiB exceeds the ${MAX_RSS_KIB} KiB trend budget.`,
    );
  }
} catch (error) {
  console.log(
    `::warning title=Main build metrics::${error instanceof Error ? error.message : String(error)}`,
  );
}
