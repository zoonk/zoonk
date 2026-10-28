import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { onTestFinished, test } from "vitest";
import { catalogFile } from "./catalogs.mts";
import { synchronizeCatalogs } from "./synchronize-catalogs.mts";
import { createTrackedAndroidXmlCodec } from "./tracked-android-xml.mts";

const SOURCE =
  '<resources><string name="title">Home</string><string name="removed">Old</string></resources>';

const TODAY =
  '<resources><string name="today_title">Today</string><string name="today_removed">Old</string></resources>';

function translate(source: string) {
  const messages = createAndroidXmlCodec().decode(source);
  const codec = createTrackedAndroidXmlCodec({ readSources: () => [source] });

  return codec.encode(messages, {
    locale: "es",
    sourceMessagesById: new Map(messages.map((message) => [message.id, message])),
  });
}

async function write({ content, path }: { content: string; path: string }) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "zoonk-android-sync-"));
  onTestFinished(() => rm(root, { force: true, recursive: true }));

  function file(catalog: string, locale: string) {
    return join(root, catalogFile({ catalog, locale }));
  }

  const files = [
    { content: SOURCE, path: file("strings", "en") },
    { content: TODAY, path: file("strings_today", "en") },
    { content: translate(SOURCE), path: file("strings", "es") },
    { content: translate(TODAY), path: file("strings_today", "es") },
  ];

  await Promise.all(files.map((entry) => write(entry)));
  return { file, root };
}

test("source deletion prunes generated keys in every catalog without retranslating remaining messages", async () => {
  const { file, root } = await fixture();

  await Promise.all([
    writeFile(file("strings", "en"), SOURCE.replace('<string name="removed">Old</string>', "")),
    writeFile(
      file("strings_today", "en"),
      TODAY.replace('<string name="today_removed">Old</string>', ""),
    ),
  ]);

  await synchronizeCatalogs({ locales: ["en", "es"], root });

  const [strings, today] = await Promise.all([
    readFile(file("strings", "es"), "utf8"),
    readFile(file("strings_today", "es"), "utf8"),
  ]);

  assert.doesNotMatch(strings, /removed/u);
  assert.doesNotMatch(today, /removed/u);
  assert.equal(createAndroidXmlCodec().decode(strings)[0]?.message, "Home");
  assert.equal(createAndroidXmlCodec().decode(today)[0]?.message, "Today");
  await synchronizeCatalogs({ locales: ["en", "es"], root });
  assert.equal(await readFile(file("strings_today", "es"), "utf8"), today);
});

test("synchronization cannot bless stale translations in any catalog and changes no file", async () => {
  const { file, root } = await fixture();
  const strings = await readFile(file("strings", "es"), "utf8");
  await writeFile(file("strings", "en"), SOURCE.replace('<string name="removed">Old</string>', ""));
  await writeFile(file("strings_today", "en"), TODAY.replace("Today", "Your day"));

  await assert.rejects(
    synchronizeCatalogs({ locales: ["es"], root }),
    /strings_today es: missing or stale/u,
  );

  assert.equal(await readFile(file("strings", "es"), "utf8"), strings);
  assert.equal(await readFile(file("strings_today", "es"), "utf8"), translate(TODAY));
});
