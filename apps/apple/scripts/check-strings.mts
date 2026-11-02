import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

type CompiledString = { key: string; table: string };

type Catalog = { strings: Record<string, unknown> };

type StringsData = { file: string; source: string; tables: Record<string, { key: string }[]> };

const appleDirectory = path.resolve(import.meta.dirname, "..");

const IGNORED_PATHS = ["DerivedData/**", "node_modules/**", "**/.build/**"];

// `make` and `pnpm iphone` build here; the compiler writes the strings each source file uses.
const STRINGSDATA = "DerivedData/*/Build/Intermediates.noindex/**/*.stringsdata";

const TEST_SOURCES = ["ZoonkTests/", "ZoonkUITests/"].map((folder) =>
  path.join(appleDirectory, folder),
);

// The format specifiers the compiler writes for interpolations, and escaped percent signs.
const FORMAT_SPECIFIER = /%%|%(?:\d+\$)?(?:@|hh[du]|h[du]|ll[du]|l[duf]|[duf])/gu;

/** Text written without a table, such as `"%@ · %@"`, needs no catalog when it has no words. */
function needsCatalog({ key, table }: CompiledString): boolean {
  return table !== "Localizable" || /\p{L}/u.test(key.replaceAll(FORMAT_SPECIFIER, ""));
}

export function readCatalog(file: string): Catalog {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Xcode and Eloqnt write these files.
  return JSON.parse(readFileSync(file, "utf8")) as Catalog;
}

export function catalogFiles(): Map<string, string> {
  const files = globSync("**/*.xcstrings", { cwd: appleDirectory, exclude: IGNORED_PATHS });

  return new Map(
    files.map((file) => [path.basename(file, ".xcstrings"), path.join(appleDirectory, file)]),
  );
}

function readStringsData(file: string): StringsData & { builtAt: number } {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The Swift compiler writes this file.
  const data = JSON.parse(readFileSync(file, "utf8")) as Omit<StringsData, "file">;
  return { ...data, builtAt: statSync(file).mtimeMs, file };
}

function isAppSource(source: string): boolean {
  return (
    existsSync(source) &&
    source.startsWith(`${appleDirectory}/`) &&
    !source.startsWith(path.join(appleDirectory, "DerivedData")) &&
    !TEST_SOURCES.some((folder) => source.startsWith(folder))
  );
}

/** Each app source file's newest build, with the strings the app looks up exactly. */
export function newestStringsData(): StringsData[] {
  const builds = globSync(STRINGSDATA, { cwd: appleDirectory })
    .map((file) => readStringsData(path.join(appleDirectory, file)))
    .filter((data) => isAppSource(data.source));

  return Map.groupBy(builds, (data) => data.source)
    .values()
    .map((versions) => versions.reduce((last, data) => (data.builtAt > last.builtAt ? data : last)))
    .toArray();
}

function compiledStrings(): CompiledString[] {
  return newestStringsData().flatMap((data) =>
    Object.entries(data.tables).flatMap(([table, strings]) =>
      strings.map(({ key }) => ({ key, table })),
    ),
  );
}

/** Reads the last build's strings, so build the app first. */
export function findMissingStrings(): { missing: CompiledString[]; total: number } {
  const strings = compiledStrings();

  if (strings.length === 0) {
    throw new Error("No build found. Build the app (`make -C apps/apple build`) first.");
  }

  const catalogs = new Map(
    [...catalogFiles()].map(([table, file]) => [table, readCatalog(file).strings]),
  );

  const missing = strings.filter(
    (string) =>
      needsCatalog(string) && !Object.hasOwn(catalogs.get(string.table) ?? {}, string.key),
  );

  return { missing, total: new Set(strings.map(({ key, table }) => `${table}\n${key}`)).size };
}

export function listStrings(strings: CompiledString[]): string {
  const lines = strings.map((string) => `  ${string.table}: ${JSON.stringify(string.key)}\n`);
  return [...new Set(lines)].join("");
}

if (import.meta.main) {
  const { missing, total } = findMissingStrings();

  if (missing.length === 0) {
    process.stdout.write(`All ${total} localized strings are in their String Catalogs.\n`);
  } else {
    process.stderr.write(
      `Missing from their String Catalogs, so they would show in English:\n${listStrings(missing)}` +
        "Run `pnpm --filter apple i18n` to add and translate them.\n",
    );

    process.exitCode = 1;
  }
}
