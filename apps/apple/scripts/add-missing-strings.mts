import { globSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  PLACEHOLDER,
  type SourceString,
  appleDirectory,
  catalogFiles,
  findMissingStrings,
  listStrings,
  normalizeKey,
  readCatalog,
} from "./check-strings.mts";

type BuiltString = SourceString & { comment?: string };

type StringsData = {
  builtAt: number;
  source: string;
  tables: Record<string, { comment?: string; key: string }[]>;
};

// `make` and `pnpm iphone` build here; the Xcode app adds new strings to the catalogs itself.
const STRINGSDATA =
  "DerivedData/*/Build/Intermediates.noindex/*.build/*/*.build/Objects-normal/*/*.stringsdata";

const XCODE_KEY_ORDER = new Intl.Collator("en", { caseFirst: "upper" });

function readStringsData(file: string): StringsData {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The Swift compiler writes this file.
  const data = JSON.parse(readFileSync(file, "utf8")) as Omit<StringsData, "builtAt">;
  return { ...data, builtAt: statSync(file).mtimeMs };
}

/** The strings in each source file's newest build, with the compiler's format specifiers. */
function builtStrings(): BuiltString[] {
  const builds = globSync(STRINGSDATA, { cwd: appleDirectory })
    .map((file) => readStringsData(path.join(appleDirectory, file)))
    .filter((data) => data.source.startsWith(`${appleDirectory}/`));

  const newest = Map.groupBy(builds, (data) => data.source)
    .values()
    .map((versions) =>
      versions.reduce((last, data) => (data.builtAt > last.builtAt ? data : last)),
    );

  return [...newest].flatMap((data) =>
    Object.entries(data.tables).flatMap(([table, strings]) =>
      strings.map((string) => ({ ...string, table })),
    ),
  );
}

function stringId({ key, table }: SourceString): string {
  return `${table}\n${normalizeKey(key)}`;
}

/** Xcode gives a string with several arguments an English value with numbered ones. */
function englishValue(key: string) {
  const specifiers = key.match(PLACEHOLDER) ?? [];

  if (specifiers.length < 2) {
    return {};
  }

  const value = key
    .split(PLACEHOLDER)
    .map((text, index) => {
      const specifier = specifiers[index];
      return specifier ? `${text}%${index + 1}$${specifier.slice(1)}` : text;
    })
    .join("");

  return { localizations: { en: { stringUnit: { state: "new", value } } } };
}

function catalogEntry({ key, uses }: { key: string; uses: BuiltString[] }) {
  const comments = [...new Set(uses.flatMap((use) => use.comment ?? []))].toSorted();
  const comment = comments.length > 0 ? { comment: comments.join("\n") } : {};

  return [key, { ...comment, ...englishValue(key) }] as const;
}

/** Writes the catalog the way Xcode does, so only the new strings show in its diff. */
function addToCatalog({ file, strings }: { file: string; strings: BuiltString[] }) {
  const catalog = readCatalog(file);

  const added = Map.groupBy(strings, (string) => string.key)
    .entries()
    .map(([key, uses]) => catalogEntry({ key, uses }));

  const entries = [...Object.entries(catalog.strings), ...added].toSorted(([first], [second]) =>
    XCODE_KEY_ORDER.compare(first, second),
  );

  const json = JSON.stringify({ ...catalog, strings: Object.fromEntries(entries) }, null, 2);
  writeFileSync(file, json.replaceAll(/^(?<key>\s*"(?:[^"\\]|\\.)*"): /gmu, "$<key> : "));
}

const { missing } = findMissingStrings();
const catalogs = catalogFiles();
const built = Map.groupBy(builtStrings(), (string) => stringId(string));

const addable = missing.filter(
  (string) => catalogs.has(string.table) && built.has(stringId(string)),
);

const unresolved = missing.filter((string) => !addable.includes(string));
const added = addable.flatMap((string) => built.get(stringId(string)) ?? []);

for (const [table, file] of catalogs) {
  const strings = added.filter((string) => string.table === table);

  if (strings.length > 0) {
    addToCatalog({ file, strings });
  }
}

if (added.length > 0) {
  process.stdout.write(`Added to their String Catalogs:\n${listStrings(added)}`);
}

if (unresolved.length > 0) {
  process.stderr.write(
    `Not added, because no build has them yet or their table has no String Catalog:\n${listStrings(unresolved)}` +
      "Build the app (`make -C apps/apple build`) or fix the string's table, then run this again.\n",
  );

  process.exitCode = 1;
}
