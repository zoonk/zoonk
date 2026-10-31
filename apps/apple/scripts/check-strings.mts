import { execFileSync } from "node:child_process";
import { globSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type SourceString = { key: string; table: string };

export type Catalog = { strings: Record<string, unknown> };

export const appleDirectory = path.resolve(import.meta.dirname, "..");

const IGNORED_PATHS = [
  "DerivedData/**",
  "node_modules/**",
  "**/.build/**",
  "ZoonkTests/**",
  "ZoonkUITests/**",
];

// Extraction without the compiler writes `%arg` where a build writes `%@`, `%lld` or `%1$@`.
export const PLACEHOLDER = /%(?:\d+\$)?(?:arg|@|lld|ld|d|f)/gu;

export function normalizeKey(key: string): string {
  return key.replaceAll(PLACEHOLDER, "%@");
}

/** Text written without a table, such as `"%arg · %arg"`, needs no catalog when it has no words. */
function needsCatalog({ key, table }: SourceString): boolean {
  return table !== "Localizable" || /\p{L}/u.test(key.replaceAll(PLACEHOLDER, ""));
}

export function readCatalog(file: string): Catalog {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Xcode and xcstringstool write these files.
  return JSON.parse(readFileSync(file, "utf8")) as Catalog;
}

export function catalogFiles(): Map<string, string> {
  const files = globSync("**/*.xcstrings", { cwd: appleDirectory, exclude: IGNORED_PATHS });

  return new Map(
    files.map((file) => [path.basename(file, ".xcstrings"), path.join(appleDirectory, file)]),
  );
}

function catalogKeys(): Map<string, Set<string>> {
  return new Map(
    [...catalogFiles()].map(([table, file]) => [
      table,
      new Set(Object.keys(readCatalog(file).strings).map((key) => normalizeKey(key))),
    ]),
  );
}

function extractSourceStrings(): SourceString[] {
  const sources = globSync("**/*.swift", { cwd: appleDirectory, exclude: IGNORED_PATHS });
  const output = mkdtempSync(path.join(tmpdir(), "zoonk-strings-"));

  try {
    execFileSync(
      "xcrun",
      [
        "xcstringstool",
        "extract",
        "--modern-localizable-strings",
        "--SwiftUI",
        "--output-format",
        "xcstrings",
        "--output-directory",
        output,
        ...sources,
      ],
      { cwd: appleDirectory, stdio: "pipe" },
    );

    return globSync("*.xcstrings", { cwd: output }).flatMap((file) =>
      Object.keys(readCatalog(path.join(output, file)).strings).map((key) => ({
        key,
        table: path.basename(file, ".xcstrings"),
      })),
    );
  } finally {
    rmSync(output, { force: true, recursive: true });
  }
}

/** Reads the Swift source without building it, so it takes seconds. */
export function findMissingStrings(): { missing: SourceString[]; total: number } {
  const catalogs = catalogKeys();
  const strings = extractSourceStrings();

  const missing = strings.filter(
    (string) => needsCatalog(string) && !catalogs.get(string.table)?.has(normalizeKey(string.key)),
  );

  return { missing, total: strings.length };
}

export function listStrings(strings: SourceString[]): string {
  const lines = strings.map((string) => `  ${string.table}: ${JSON.stringify(string.key)}\n`);
  return [...new Set(lines)].join("");
}

if (import.meta.main) {
  const { missing, total } = findMissingStrings();

  if (missing.length === 0) {
    process.stdout.write(`All ${total} localized strings are in their String Catalogs.\n`);
  } else {
    const count =
      missing.length === 1 ? "1 localized string is" : `${missing.length} localized strings are`;

    process.stderr.write(
      `${count} missing from their String Catalogs:\n${listStrings(missing)}` +
        "Build the app, then run `pnpm --filter apple i18n` to add and translate them.\n",
    );

    process.exitCode = 1;
  }
}
