import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { onTestFinished, test } from "vitest";
import { catalogFile, catalogNames, catalogPath } from "./catalogs.mts";
import { createTrackedAndroidXmlCodec } from "./tracked-android-xml.mts";

const SOURCE = '<resources><string name="title">Home</string></resources>';
const TODAY = '<resources><string name="today_title">Today</string></resources>';

const CLI = fileURLToPath(
  new URL("../../node_modules/@eloqnt/cli/dist/bin/eloqnt.mjs", import.meta.url),
);

const CATALOGS = fileURLToPath(new URL("catalogs.mts", import.meta.url));
const CODEC = fileURLToPath(new URL("tracked-android-xml.mts", import.meta.url));

function translate({ source, translation }: { source: string; translation: string }) {
  const messages = createAndroidXmlCodec().decode(source);
  const codec = createTrackedAndroidXmlCodec({ readSources: () => [source] });

  return codec.encode(
    messages.map((message) => ({ ...message, message: translation })),
    { locale: "es", sourceMessagesById: new Map(messages.map((message) => [message.id, message])) },
  );
}

async function fixture({ today = TODAY, translated = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "zoonk-android-i18n-"));
  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  const files = [
    { content: SOURCE, path: catalogFile({ catalog: "strings", locale: "en" }) },
    { content: today, path: catalogFile({ catalog: "strings_today", locale: "en" }) },
    {
      content: translate({ source: SOURCE, translation: "Inicio" }),
      path: catalogFile({ catalog: "strings", locale: "es" }),
    },
    {
      content: translated ? translate({ source: TODAY, translation: "Hoy" }) : undefined,
      path: catalogFile({ catalog: "strings_today", locale: "es" }),
    },
    {
      content: `
        import {readSourceCatalogs} from ${JSON.stringify(CATALOGS)};
        import {createTrackedAndroidXmlCodec} from ${JSON.stringify(CODEC)};
        export default () => createTrackedAndroidXmlCodec({
          readSources: () => readSourceCatalogs(${JSON.stringify(directory)})
        });
      `,
      path: ".eloqnt/codec.mjs",
    },
  ];

  async function write({ content, path }: { content?: string; path: string }) {
    if (content === undefined) {
      return;
    }

    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), content);
  }

  await Promise.all(files.map((file) => write(file)));
  const paths = catalogNames(directory).map((catalog) => catalogPath(catalog));

  await writeFile(
    join(directory, ".eloqnt/config.mjs"),
    `export default {
      messages: {sourceLocale: 'en', locales: ['en', 'es'], path: ${JSON.stringify(paths)},
        format: {codec: './.eloqnt/codec.mjs', extension: '.xml'}}
    };`,
  );

  return directory;
}

const execFileAsync = promisify(execFile);

async function lint(directory: string) {
  try {
    const { stderr, stdout } = await execFileAsync(process.execPath, [CLI, "lint", "--strict"], {
      cwd: directory,
      timeout: 30_000,
    });

    return { output: `${stdout}${stderr}`, status: 0 };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && typeof error.code === "number")) {
      throw error;
    }

    const output = ["stdout" in error ? error.stdout : "", "stderr" in error ? error.stderr : ""];
    return { output: output.join(""), status: error.code };
  }
}

test("the real Eloqnt CLI rejects stale, missing, and removed entries in any catalog without model credentials", async () => {
  const [clean, stale, missingLocale, removed] = await Promise.all([
    fixture().then(lint),
    fixture({ today: TODAY.replace("Today", "Your day") }).then(lint),
    fixture({ translated: false }).then(lint),
    fixture({ today: "<resources />" }).then(lint),
  ]);

  assert.equal(clean.status, 0, clean.output);
  assert.equal(stale.status, 1, stale.output);
  assert.match(stale.output, /missing-translation/u);
  assert.equal(missingLocale.status, 1, missingLocale.output);
  assert.match(missingLocale.output, /missing-translation/u);
  assert.equal(removed.status, 1, removed.output);
  assert.match(removed.output, /superfluous-key/u);
});
