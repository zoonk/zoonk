import { readFileSync, writeFileSync } from "node:fs";
import {
  type CompiledString,
  FORMAT_SPECIFIER,
  catalogFiles,
  findMissingStrings,
  listStrings,
  readCatalog,
} from "./check-strings.mts";

const XCODE_KEY_ORDER = new Intl.Collator("en", { caseFirst: "upper" });

/** Xcode numbers the arguments of a string that has several, so a translation can reorder them. */
function numberArguments(text: string): string {
  const specifiers = (text.match(FORMAT_SPECIFIER) ?? []).filter((specifier) => specifier !== "%%");

  if (specifiers.length < 2 || specifiers.some((specifier) => specifier.includes("$"))) {
    return text;
  }

  let position = 0;

  return text.replaceAll(FORMAT_SPECIFIER, (specifier) =>
    specifier === "%%" ? specifier : `%${(position += 1)}$${specifier.slice(1)}`,
  );
}

function catalogEntry(key: string, uses: CompiledString[]) {
  const comments = [...new Set(uses.flatMap((use) => use.comment ?? []))].toSorted();
  const value = uses.find((use) => use.value !== undefined)?.value;
  const english = numberArguments(value ?? key);

  return [
    key,
    {
      ...(comments.length > 0 && { comment: comments.join("\n") }),
      ...(value !== undefined && { extractionState: "extracted_with_value" }),
      ...(english !== key && {
        localizations: { en: { stringUnit: { state: "new", value: english } } },
      }),
    },
  ] as const;
}

/** Writes the catalog the way Xcode does, so only the new strings show in its diff. */
function addToCatalog(file: string, strings: CompiledString[]) {
  const catalog = readCatalog(file);

  const added = Map.groupBy(strings, (string) => string.key)
    .entries()
    .map(([key, uses]) => catalogEntry(key, uses));

  const entries = [...Object.entries(catalog.strings), ...added].toSorted(([first], [second]) =>
    XCODE_KEY_ORDER.compare(first, second),
  );

  const json = JSON.stringify({ ...catalog, strings: Object.fromEntries(entries) }, null, 2);
  const ending = readFileSync(file, "utf8").endsWith("\n") ? "\n" : "";

  writeFileSync(
    file,
    `${json.replaceAll(/^(?<key>\s*"(?:[^"\\]|\\.)*"): /gmu, "$<key> : ")}${ending}`,
  );
}

const { missing } = findMissingStrings();
const catalogs = catalogFiles();
const unresolved = missing.filter((string) => !catalogs.has(string.table));

for (const [table, file] of catalogs) {
  const strings = missing.filter((string) => string.table === table);

  if (strings.length > 0) {
    addToCatalog(file, strings);
  }
}

const added = missing.filter((string) => catalogs.has(string.table));

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
