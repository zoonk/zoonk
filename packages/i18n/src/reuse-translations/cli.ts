#!/usr/bin/env node
import { packageAt, readCatalogs } from "./catalogs.ts";
import { findReuses } from "./find-reuses.ts";

const packageName = packageAt(process.cwd());
const catalogs = await readCatalogs(packageName);
const reuses = findReuses({ catalogs, packageName });
const byCatalog = [...Map.groupBy(reuses, (reuse) => reuse.catalog)];

await Promise.all(byCatalog.map(([catalog, entries]) => catalog.write(entries)));

const lines = byCatalog.map(([catalog, entries]) => {
  const counts = [...Map.groupBy(entries, (entry) => entry.locale)]
    .toSorted(([first], [second]) => first.localeCompare(second))
    .map(([locale, localeEntries]) => `${locale} ${localeEntries.length}`);

  return `  ${catalog.name}: ${counts.join(", ")}\n`;
});

const noun = reuses.length === 1 ? "translation" : "translations";
process.stdout.write(`Reused ${reuses.length} existing ${noun}\n${lines.join("")}`);
