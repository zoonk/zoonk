import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { onTestFinished, test } from "vitest";
import { createTrackedAndroidXmlCodec } from "./tracked-android-xml.mts";

const SOURCE = '<resources><string name="title">Home</string></resources>';

const CLI = fileURLToPath(
  new URL("../../node_modules/@eloqnt/cli/dist/bin/eloqnt.mjs", import.meta.url),
);

const CODEC = fileURLToPath(new URL("tracked-android-xml.mts", import.meta.url));

/**
 * A project whose Spanish catalog was translated from `SOURCE`, with the English catalog now
 * reading `source`, and no Spanish catalog at all when `translated` is false.
 */
async function fixture({ source = SOURCE, translated = true } = {}) {
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
    writeFile(sourceFile, source),
    translated ? writeFile(targetFile, target) : undefined,
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

  return directory;
}

const execFileAsync = promisify(execFile);

/** `eloqnt lint --strict` in the project: its exit status and everything it printed. */
async function lint(directory: string) {
  try {
    const { stderr, stdout } = await execFileAsync(process.execPath, [CLI, "lint", "--strict"], {
      cwd: directory,
      timeout: 30_000,
    });

    return { output: `${stdout}${stderr}`, status: 0 };
  } catch (error) {
    // A lint that finds problems exits with 1, which `execFile` rejects with, output included.
    if (!(error instanceof Error && "code" in error && typeof error.code === "number")) {
      throw error;
    }

    const output = ["stdout" in error ? error.stdout : "", "stderr" in error ? error.stderr : ""];
    return { output: output.join(""), status: error.code };
  }
}

// Each case is its own project, linted at the same time: one CLI start at a time took over 5 s on a
// busy CI runner.
test("the real Eloqnt CLI rejects stale, missing, and removed entries without model credentials", async () => {
  const [clean, stale, missingLocale, removed] = await Promise.all([
    fixture().then(lint),
    fixture({ source: SOURCE.replace("Home", "Your home") }).then(lint),
    fixture({ translated: false }).then(lint),
    fixture({ source: "<resources />" }).then(lint),
  ]);

  assert.equal(clean.status, 0, clean.output);
  assert.equal(stale.status, 1, stale.output);
  assert.match(stale.output, /missing-translation/u);
  assert.equal(missingLocale.status, 1, missingLocale.output);
  assert.match(missingLocale.output, /missing-translation/u);
  assert.equal(removed.status, 1, removed.output);
  assert.match(removed.output, /superfluous-key/u);
});
