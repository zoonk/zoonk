import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  globSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

type CompiledString = { key: string; table: string };

type CatalogEntry = { comment?: string; extractionState?: string };

type Catalog = { strings: Record<string, CatalogEntry> };

type StringsData = {
  file: string;
  source: string;
  tables: Record<string, { key: string; comment: string }[]>;
};

type CatalogChange = {
  file: string;
  catalog: Catalog;
  added: CompiledString[];
  removed: CompiledString[];
  updated: CompiledString[];
};

const appleDirectory = path.resolve(import.meta.dirname, "..");

const IGNORED_PATHS = ["DerivedData/**", "node_modules/**", "**/.build/**"];

// `make` and `pnpm iphone` build here; the compiler writes the strings each source file uses.
const STRINGSDATA =
  "DerivedData/*/Build/Intermediates.noindex/Zoonk.build/Debug-*/Zoonk.build/**/*.stringsdata";

const sourceDirectory = path.join(appleDirectory, "Zoonk");

// The format specifiers the compiler writes for interpolations, and escaped percent signs.
const FORMAT_SPECIFIER = /%%|%(?:\d+\$)?(?:@|hh[du]|h[du]|ll[du]|l[duf]|[duf])/gu;

/** Text written without a table, such as `"%@ · %@"`, needs no catalog when it has no words. */
function needsCatalog({ key, table }: CompiledString): boolean {
  return table !== "Localizable" || /\p{L}/u.test(key.replaceAll(FORMAT_SPECIFIER, ""));
}

function readCatalog(file: string): Catalog {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Xcode and Eloqnt write these files.
  return JSON.parse(readFileSync(file, "utf8")) as Catalog;
}

function catalogFiles(): Map<string, string> {
  const files = globSync("**/*.xcstrings", { cwd: appleDirectory, exclude: IGNORED_PATHS });

  return new Map(
    files.map((file) => [path.basename(file, ".xcstrings"), path.join(appleDirectory, file)]),
  );
}

function readStringsData(file: string): StringsData & { builtAt: number } {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The Swift compiler writes this file.
  const data = JSON.parse(readFileSync(file, "utf8")) as Omit<StringsData, "file">;
  const source = existsSync(data.source) ? realpathSync(data.source) : data.source;
  // Swift leaves a .stringsdata file untouched when its extracted strings are unchanged.
  const object = statSync(file.replace(/\.stringsdata$/u, ".o"), { throwIfNoEntry: false });
  const builtAt = Math.max(statSync(file).mtimeMs, object?.mtimeMs ?? 0);

  return { ...data, builtAt, file, source };
}

/** Each app source file's newest build, with the strings the app looks up exactly. */
function newestStringsData(): StringsData[] {
  const sources = globSync("**/*.swift", { cwd: sourceDirectory }).map((file) =>
    path.join(sourceDirectory, file),
  );

  const sourceTimes = new Map(sources.map((file) => [file, statSync(file).mtimeMs]));

  const builds = globSync(STRINGSDATA, { cwd: appleDirectory })
    .map((file) => readStringsData(path.join(appleDirectory, file)))
    .filter((data) => data.builtAt >= (sourceTimes.get(data.source) ?? Infinity));

  const bySource = Map.groupBy(builds, (data) => data.source);

  if (bySource.size < sourceTimes.size) {
    throw new Error(
      `Missing current string extraction for ${sourceTimes.size - bySource.size} Swift files. Build the Debug app (` +
        "`make -C apps/apple build`) before checking or syncing catalogs.",
    );
  }

  return [...bySource.values()].map((versions) =>
    versions.reduce((last, data) => (data.builtAt > last.builtAt ? data : last)),
  );
}

function syncedStrings({ data, file }: { data: StringsData[]; file: string }) {
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
        ...data.flatMap((entry) => ["--stringsdata", entry.file]),
        "--skip-marking-strings-stale",
      ],
      { stdio: "pipe" },
    );

    return readCatalog(copy).strings;
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function syncCatalog({
  compiled,
  file,
  table,
}: {
  compiled: StringsData[];
  file: string;
  table: string;
}): CatalogChange {
  const catalog = readCatalog(file);
  const entries = new Map(Object.entries(catalog.strings));
  const data = compiled.filter(({ tables }) => Object.hasOwn(tables, table));
  const strings = data.flatMap(({ tables }) => tables[table] ?? []);
  const currentKeys = new Set(strings.map(({ key }) => key));
  const commentedKeys = new Set(strings.filter(({ comment }) => comment).map(({ key }) => key));
  const added = [...currentKeys].filter((key) => !entries.has(key));

  const removed = [...entries]
    .filter(([key, entry]) => !currentKeys.has(key) && entry.extractionState !== "manual")
    .map(([key]) => key);

  const updated: string[] = [];
  const synced = data.length > 0 ? syncedStrings({ data, file }) : {};

  for (const [key, entry] of Object.entries(synced).filter(([catalogKey]) =>
    currentKeys.has(catalogKey),
  )) {
    if (!commentedKeys.has(key) && entry.extractionState !== "manual") {
      delete entry.comment;
    }

    const original = entries.get(key);

    if (!isDeepStrictEqual(original, entry)) {
      entries.set(key, entry);

      if (original) {
        updated.push(key);
      }
    }
  }

  for (const key of removed) {
    entries.delete(key);
  }

  return {
    added: added.map((key) => ({ key, table })),
    catalog: { ...catalog, strings: Object.fromEntries(entries) },
    file,
    removed: removed.map((key) => ({ key, table })),
    updated: updated.map((key) => ({ key, table })),
  };
}

function syncCatalogs({ write }: { write: boolean }): void {
  const compiled = newestStringsData();
  const catalogs = catalogFiles();
  const changes = [...catalogs].map(([table, file]) => syncCatalog({ compiled, file, table }));

  const unresolved = compiled.flatMap(({ tables }) =>
    Object.entries(tables)
      .filter(([table]) => !catalogs.has(table))
      .flatMap(([table, strings]) =>
        strings.map(({ key }) => ({ key, table })).filter((string) => needsCatalog(string)),
      ),
  );

  const added = changes.flatMap((change) => change.added);
  const removed = changes.flatMap((change) => change.removed);
  const updated = changes.flatMap((change) => change.updated);

  if (unresolved.length > 0) {
    process.stderr.write(
      `No String Catalog for:\n${listStrings(unresolved)}` +
        "Give each string the `table:` of its feature's catalog.\n",
    );

    process.exitCode = 1;
    return;
  }

  if (added.length + removed.length + updated.length === 0) {
    process.stdout.write("String Catalogs match the built app.\n");
    return;
  }

  const report =
    (added.length > 0 ? `Missing from their String Catalogs:\n${listStrings(added)}` : "") +
    (removed.length > 0 ? `Unused String Catalog entries:\n${listStrings(removed)}` : "") +
    (updated.length > 0 ? `Outdated String Catalog entries:\n${listStrings(updated)}` : "");

  if (!write) {
    process.stderr.write(
      `${report}Run \`pnpm --filter apple i18n:sync\` to sync, then translate any new strings.\n`,
    );

    process.exitCode = 1;
    return;
  }

  for (const change of changes) {
    if (change.added.length + change.removed.length + change.updated.length > 0) {
      const { catalog, file } = change;
      const source = readFileSync(file, "utf8");

      const json = JSON.stringify(catalog, null, 2).replaceAll(
        /^(?<key>\s*"(?:[^"\\]|\\.)*"): /gmu,
        "$<key> : ",
      );

      writeFileSync(file, source.endsWith("\n") ? `${json}\n` : json);
    }
  }

  process.stdout.write(
    `Synced String Catalogs (${added.length} added, ${removed.length} removed, ${updated.length} updated).\n`,
  );
}

function listStrings(strings: CompiledString[]): string {
  const lines = strings.map((string) => `  ${string.table}: ${JSON.stringify(string.key)}\n`);
  return [...new Set(lines)].join("");
}

if (import.meta.main) {
  syncCatalogs({ write: process.argv.includes("--write") });
}
