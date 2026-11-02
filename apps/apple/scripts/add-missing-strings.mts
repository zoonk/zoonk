import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  catalogFiles,
  findMissingStrings,
  listStrings,
  newestStringsData,
  readCatalog,
} from "./check-strings.mts";

const XCODE_KEY_ORDER = new Intl.Collator("en", { caseFirst: "upper" });

/** Xcode's entries for these keys. `xcstringstool sync` rewrites a whole catalog, so it syncs a copy. */
function syncedEntries(table: string, file: string, keys: Set<string>): [string, unknown][] {
  const stringsData = newestStringsData().filter((data) => Object.hasOwn(data.tables, table));
  const directory = mkdtempSync(path.join(tmpdir(), "zoonk-strings-"));
  const copy = path.join(directory, path.basename(file));

  try {
    copyFileSync(file, copy);

    execFileSync(
      "xcrun",
      [
        "xcstringstool",
        "sync",
        copy,
        ...stringsData.flatMap((data) => ["--stringsdata", data.file]),
        "--skip-marking-strings-stale",
      ],
      { stdio: "pipe" },
    );

    return Object.entries(readCatalog(copy).strings).filter(([key]) => keys.has(key));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

/** Writes the catalog the way Xcode does, so only the new strings show in its diff. */
function addToCatalog(file: string, added: [string, unknown][]) {
  const source = readFileSync(file, "utf8");
  const catalog = readCatalog(file);

  const entries = [...Object.entries(catalog.strings), ...added].toSorted(([first], [second]) =>
    XCODE_KEY_ORDER.compare(first, second),
  );

  const json = JSON.stringify({ ...catalog, strings: Object.fromEntries(entries) }, null, 2);
  const ending = source.endsWith("\n") ? "\n" : "";

  writeFileSync(
    file,
    `${json.replaceAll(/^(?<key>\s*"(?:[^"\\]|\\.)*"): /gmu, "$<key> : ")}${ending}`,
  );
}

const { missing } = findMissingStrings();
const catalogs = catalogFiles();
const added = missing.filter((string) => catalogs.has(string.table));
const unresolved = missing.filter((string) => !catalogs.has(string.table));

for (const [table, strings] of Map.groupBy(added, (string) => string.table)) {
  const file = catalogs.get(table) ?? "";
  addToCatalog(file, syncedEntries(table, file, new Set(strings.map((string) => string.key))));
}

if (added.length > 0) {
  process.stdout.write(`Added to their String Catalogs:\n${listStrings(added)}`);
}

if (unresolved.length > 0) {
  process.stderr.write(
    `Not added, because their table has no String Catalog:\n${listStrings(unresolved)}` +
      "Write each one with the `table:` of its feature's catalog.\n",
  );

  process.exitCode = 1;
}
