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

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "zoonk-android-sync-"));
  onTestFinished(() => rm(root, { force: true, recursive: true }));
  const sourceFile = join(root, catalogFile("en"));
  const targetFile = join(root, catalogFile("es"));
  const messages = createAndroidXmlCodec().decode(SOURCE);
  const codec = createTrackedAndroidXmlCodec({ readSource: () => SOURCE });

  const target = codec.encode(messages, {
    locale: "es",
    sourceMessagesById: new Map(messages.map((message) => [message.id, message])),
  });

  await Promise.all([
    mkdir(dirname(sourceFile), { recursive: true }),
    mkdir(dirname(targetFile), { recursive: true }),
  ]);

  await Promise.all([writeFile(sourceFile, SOURCE), writeFile(targetFile, target)]);
  return { root, sourceFile, target, targetFile };
}

test("source deletion prunes generated keys without retranslating remaining messages", async () => {
  const { root, sourceFile, targetFile } = await fixture();
  await writeFile(sourceFile, SOURCE.replace('<string name="removed">Old</string>', ""));
  await synchronizeCatalogs({ locales: ["en", "es"], root });
  const xml = await readFile(targetFile, "utf8");
  assert.doesNotMatch(xml, /removed/u);
  assert.equal(createAndroidXmlCodec().decode(xml)[0]?.message, "Home");
  await synchronizeCatalogs({ locales: ["en", "es"], root });
  assert.equal(await readFile(targetFile, "utf8"), xml);
});

test("synchronization cannot bless stale translations and does not change incomplete catalogs", async () => {
  const { root, sourceFile, targetFile, target } = await fixture();
  await writeFile(sourceFile, SOURCE.replace("Home", "Your home"));
  await assert.rejects(synchronizeCatalogs({ locales: ["es"], root }), /missing or stale/u);
  assert.equal(await readFile(targetFile, "utf8"), target);
});
