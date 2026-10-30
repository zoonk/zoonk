import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { onTestFinished, test } from "vitest";
import { acceptTranslations } from "./accept-translations.mts";
import { catalogFile } from "./catalogs.mts";
import { createTrackedAndroidXmlCodec } from "./tracked-android-xml.mts";

const SOURCE =
  '<resources><string name="title">Home</string><string name="other">Old</string></resources>';

const TODAY = '<resources><string name="today_title">Today</string></resources>';

function translate(source: string, locale: string) {
  const messages = createAndroidXmlCodec().decode(source);
  const codec = createTrackedAndroidXmlCodec({ readSources: () => [source] });

  return codec.encode(messages, {
    locale,
    sourceMessagesById: new Map(messages.map((message) => [message.id, message])),
  });
}

function translations(content: string, locale: string) {
  return createTrackedAndroidXmlCodec({ readSources: () => [SOURCE] })
    .decode(content, { locale, sourceLocale: "en" })
    .map((message) => message.message);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "zoonk-android-accept-"));
  onTestFinished(() => rm(root, { force: true, recursive: true }));

  function file(catalog: string, locale: string) {
    return join(root, catalogFile({ catalog, locale }));
  }

  const handEdited = translate(SOURCE, "es")
    .replace(">Home<", ">Inicio<")
    .replace(">Old<", ">Viejo<");

  const files = [
    { content: SOURCE, path: file("strings", "en") },
    { content: TODAY, path: file("strings_today", "en") },
    { content: handEdited, path: file("strings", "es") },
    { content: handEdited, path: file("strings", "fr") },
    { content: translate(TODAY, "es"), path: file("strings_today", "es") },
  ];

  await Promise.all(
    files.map(async ({ content, path }) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }),
  );

  return { file, root };
}

test("accepting a hand edit freshens only the given ids in the given locales", async () => {
  const { file, root } = await fixture();

  const [french, today] = await Promise.all([
    readFile(file("strings", "fr"), "utf8"),
    readFile(file("strings_today", "es"), "utf8"),
  ]);

  await acceptTranslations({ ids: ["title"], locales: ["es"], root });

  assert.deepEqual(translations(await readFile(file("strings", "es"), "utf8"), "es"), [
    "Inicio",
    "",
  ]);

  assert.equal(await readFile(file("strings", "fr"), "utf8"), french);
  assert.equal(await readFile(file("strings_today", "es"), "utf8"), today);
});

test("an unknown id or a non-target locale changes no file", async () => {
  const { file, root } = await fixture();
  const spanish = await readFile(file("strings", "es"), "utf8");

  await assert.rejects(
    acceptTranslations({ ids: ["title", "missing"], locales: ["es"], root }),
    /es:missing/u,
  );

  await assert.rejects(
    acceptTranslations({ ids: ["title"], locales: ["en"], root }),
    /Not a target locale: en/u,
  );

  assert.equal(await readFile(file("strings", "es"), "utf8"), spanish);
});
