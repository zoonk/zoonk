import { globSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createXcstringsCodec from "@eloqnt/format-apple-xcstrings";
import createPoCodec from "@eloqnt/format-po";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { z } from "zod";
import createAndroidCodec from "../../../../apps/android/.eloqnt/android-xml.ts";
import { catalogFile, catalogNames } from "../../../../apps/android/scripts/i18n/catalogs.mts";
import { type Catalog, PACKAGES, type PackageName, type Reuse } from "./find-reuses.ts";

type Message = {
  id: string;
  message: string;
  description: string[];
  references: { path: string; line?: number }[];
  printf?: unknown;
};

type SeparateFileCodec = {
  decode: (content: string, context: { locale: string; sourceLocale: string }) => Message[];
  encode: (
    messages: Message[],
    context: { locale: string; sourceMessagesById: Map<string, Message> },
  ) => string;
};

export type ReadCatalog = Catalog & { write: (reuses: Reuse[]) => Promise<void> };

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

const PACKAGE_ROOTS: Record<PackageName, string> = {
  android: "apps/android",
  api: "apps/api",
  apple: "apps/apple",
  learn: "packages/learn",
  main: "apps/main",
  player: "packages/player",
};

const TARGET_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

const Localization = z.object({ stringUnit: z.object({ state: z.string() }).optional() });
const StringEntry = z.object({ localizations: z.record(z.string(), Localization).optional() });
const StringCatalogStates = z.object({ strings: z.record(z.string(), StringEntry) });

const PrintfArguments = z
  .object({ byName: z.record(z.string(), z.object({ suffix: z.string() })) })
  .optional();

function packageRoot(packageName: PackageName) {
  return resolve(REPO_ROOT, PACKAGE_ROOTS[packageName]);
}

export function packageAt(directory: string) {
  const packageName = PACKAGES.find((name) => packageRoot(name) === resolve(directory));

  if (!packageName) {
    throw new Error(`${directory} isn't a package with translation catalogs.`);
  }

  return packageName;
}

function isMissingFile(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** The Apple and Android codecs keep each argument's printf conversion on the decoded English; `%@` is Apple's `%s`. */
function placeholderKinds(message: Message) {
  const printf = PrintfArguments.parse(message.printf);

  return Object.fromEntries(
    Object.entries(printf?.byName ?? {}).map(([name, { suffix }]) => [
      name,
      suffix.endsWith("@") ? "s" : suffix.at(-1),
    ]),
  );
}

function toCatalog({
  packageName,
  name,
  source,
  targets,
}: {
  packageName: PackageName;
  name: string;
  source: Message[];
  targets: Partial<Record<string, Message[]>>;
}): Catalog {
  const translationsByLocale = TARGET_LOCALES.map((locale) => ({
    locale,
    translations: new Map((targets[locale] ?? []).map((message) => [message.id, message.message])),
  }));

  return {
    locales: TARGET_LOCALES,
    messages: source.map((message) => ({
      comment: message.description.join("\n").trim(),
      english: message.message,
      id: message.id,
      kinds: placeholderKinds(message),
      translations: Object.fromEntries(
        translationsByLocale.map(({ locale, translations }) => [
          locale,
          translations.get(message.id),
        ]),
      ),
    })),
    name,
    packageName,
  };
}

/** Merges translations the way `eloqnt translate` does, so each codec writes what an Eloqnt run would. */
function withReuses({
  source,
  target,
  reuses,
}: {
  source: Message[];
  target: Message[];
  reuses: Reuse[];
}): Message[] {
  const existing = new Map(target.map((message) => [message.id, message]));
  const translations = new Map(reuses.map((reuse) => [reuse.id, reuse.translation]));
  const sourceIds = new Set(source.map((message) => message.id));

  const merged = source.flatMap((sourceMessage) => {
    const current = existing.get(sourceMessage.id);
    const translation = translations.get(sourceMessage.id);

    if (translation === undefined) {
      return current ? [current] : [];
    }

    return [
      {
        description: current?.description ?? sourceMessage.description,
        id: sourceMessage.id,
        message: translation,
        references: current?.references ?? sourceMessage.references,
      },
    ];
  });

  return [...merged, ...target.filter((message) => !sourceIds.has(message.id))];
}

function byLocale(reuses: Reuse[]) {
  return [...Map.groupBy(reuses, (reuse) => reuse.locale)];
}

async function readSeparateFileCatalog({
  packageName,
  name,
  codec,
  file,
}: {
  packageName: PackageName;
  name: string;
  codec: SeparateFileCodec;
  file: (locale: string) => string;
}): Promise<ReadCatalog> {
  const decode = (locale: string, content: string) =>
    codec.decode(content, { locale, sourceLocale: DEFAULT_LOCALE });

  const source = decode(DEFAULT_LOCALE, await readFile(file(DEFAULT_LOCALE), "utf8"));
  const sourceMessagesById = new Map(source.map((message) => [message.id, message]));

  /** A locale file Eloqnt hasn't created yet has no translations. */
  async function decodeTarget(locale: string) {
    try {
      return decode(locale, await readFile(file(locale), "utf8"));
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }

      throw error;
    }
  }

  const targets = Object.fromEntries(
    await Promise.all(
      TARGET_LOCALES.map(async (locale) => [locale, await decodeTarget(locale)] as const),
    ),
  );

  async function write(reuses: Reuse[]) {
    await Promise.all(
      byLocale(reuses).map(([locale, entries]) =>
        writeFile(
          file(locale),
          codec.encode(withReuses({ reuses: entries, source, target: targets[locale] ?? [] }), {
            locale,
            sourceMessagesById,
          }),
        ),
      ),
    );
  }

  return { ...toCatalog({ name, packageName, source, targets }), write };
}

/** Marking a string `needs_review` is how Apple asks Eloqnt to translate it again. */
function retranslateLocales(content: string) {
  const { strings } = StringCatalogStates.parse(JSON.parse(content));

  return (id: string) =>
    TARGET_LOCALES.filter(
      (locale) => strings[id]?.localizations?.[locale]?.stringUnit?.state === "needs_review",
    );
}

async function readAppleCatalog(file: string): Promise<ReadCatalog> {
  const codec = createXcstringsCodec();
  const content = await readFile(file, "utf8");
  const targets = codec.decodeAll(content);
  const source = targets[DEFAULT_LOCALE] ?? [];
  const retranslate = retranslateLocales(content);
  const catalog = toCatalog({ name: basename(file), packageName: "apple", source, targets });

  async function write(reuses: Reuse[]) {
    const messagesByLocale = Object.fromEntries(
      byLocale(reuses).map(([locale, entries]) => [
        locale,
        withReuses({ reuses: entries, source, target: targets[locale] ?? [] }),
      ]),
    );

    await writeFile(file, codec.encodeAll(messagesByLocale, { sourceLocale: DEFAULT_LOCALE }));
  }

  return {
    ...catalog,
    messages: catalog.messages.map((message) => ({
      ...message,
      retranslate: retranslate(message.id),
    })),
    write,
  };
}

function readPackage(packageName: PackageName): Promise<ReadCatalog>[] {
  const root = packageRoot(packageName);

  if (packageName === "apple") {
    return globSync("Zoonk/Resources/Localization/*.xcstrings", { cwd: root })
      .toSorted()
      .map((file) => readAppleCatalog(resolve(root, file)));
  }

  // Android's own codec reads a stale translation as missing and fingerprints what it writes.
  if (packageName === "android") {
    return catalogNames(root).map((catalog) =>
      readSeparateFileCatalog({
        codec: createAndroidCodec(),
        file: (locale) => resolve(root, catalogFile({ catalog, locale })),
        name: catalog,
        packageName,
      }),
    );
  }

  return [
    readSeparateFileCatalog({
      codec: createPoCodec(),
      file: (locale) => resolve(root, "messages", `${locale}.po`),
      name: "messages",
      packageName,
    }),
  ];
}

/**
 * Reads every package's catalogs. Another package's catalog that doesn't parse is left out, since a parallel `i18n`
 * run may be writing it; one of `packageName`'s throws.
 */
export async function readCatalogs(packageName: PackageName) {
  const reads = PACKAGES.flatMap((name) =>
    readPackage(name).map((catalog) => ({ catalog, isOwn: name === packageName })),
  );

  const results = await Promise.allSettled(reads.map((read) => read.catalog));

  const ownFailure = results.find(
    (result, index) => result.status === "rejected" && reads[index]?.isOwn,
  );

  if (ownFailure?.status === "rejected") {
    throw ownFailure.reason;
  }

  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}
