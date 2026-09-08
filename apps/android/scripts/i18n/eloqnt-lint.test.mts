import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { onTestFinished, test } from "vitest";
import { createTrackedAndroidXmlCodec } from "./tracked-android-xml.mts";

const SOURCE = '<resources><string name="title">Home</string></resources>';

const CLI = fileURLToPath(
  new URL("../../node_modules/@eloqnt/cli/dist/bin/eloqnt.mjs", import.meta.url),
);

const CODEC = fileURLToPath(new URL("tracked-android-xml.mts", import.meta.url));

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "zoonk-android-i18n-"));
  onTestFinished(() => rm(directory, { force: true, recursive: true }));
  await mkdir(join(directory, ".eloqnt"));
  const codecFile = join(directory, ".eloqnt/codec.mjs");
  const sourceFile = join(directory, "en.xml");
  const targetFile = join(directory, "es.xml");
  const messages = createAndroidXmlCodec().decode(SOURCE);
  const codec = createTrackedAndroidXmlCodec({ readSource: () => SOURCE });

  const target = codec.encode(
    messages.map((message) => ({ ...message, message: "Inicio" })),
    { locale: "es", sourceMessagesById: new Map(messages.map((message) => [message.id, message])) },
  );

  await Promise.all([
    writeFile(sourceFile, SOURCE),
    writeFile(targetFile, target),
    writeFile(
      codecFile,
      `
      import {readFileSync} from 'node:fs';
      import {createTrackedAndroidXmlCodec} from ${JSON.stringify(CODEC)};
      export default () => createTrackedAndroidXmlCodec({
        readSource: () => readFileSync(${JSON.stringify(sourceFile)}, 'utf8')
      });
    `,
    ),
    writeFile(
      join(directory, ".eloqnt/config.mjs"),
      `export default {
      messages: {sourceLocale: 'en', locales: ['en', 'es'], path: './{locale}',
        format: {codec: ${JSON.stringify(codecFile)}, extension: '.xml'}}
    };`,
    ),
  ]);

  return { directory, sourceFile, target, targetFile };
}

function lint(directory: string) {
  const result = spawnSync(process.execPath, [CLI, "lint", "--strict"], {
    cwd: directory,
    encoding: "utf8",
    timeout: 30_000,
  });

  if (result.error) {
    throw result.error;
  }

  return { output: `${result.stdout}${result.stderr}`, status: result.status };
}

test("the real Eloqnt CLI rejects stale, missing, and removed entries without model credentials", async () => {
  const { directory, sourceFile, targetFile, target } = await fixture();
  const clean = lint(directory);
  assert.equal(clean.status, 0, clean.output);

  await writeFile(sourceFile, SOURCE.replace("Home", "Your home"));
  const stale = lint(directory);
  assert.equal(stale.status, 1, stale.output);
  assert.match(stale.output, /missing-translation/u);

  await writeFile(sourceFile, SOURCE);
  await rm(targetFile);
  const missingLocale = lint(directory);
  assert.equal(missingLocale.status, 1, missingLocale.output);
  assert.match(missingLocale.output, /missing-translation/u);

  await writeFile(targetFile, target);
  await writeFile(sourceFile, "<resources />");
  const removed = lint(directory);
  assert.equal(removed.status, 1, removed.output);
  assert.match(removed.output, /superfluous-key/u);
});
