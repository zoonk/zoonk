#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import createPoCodec from "@eloqnt/format-po";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { findBrokenFormats } from "./find-broken-formats.ts";

const SOURCE_CATALOG = `messages/${DEFAULT_LOCALE}.po`;

const messages = createPoCodec().decode(await readFile(SOURCE_CATALOG, "utf8"), {
  locale: DEFAULT_LOCALE,
  sourceLocale: DEFAULT_LOCALE,
});

const found = messages.flatMap(({ id, message }) =>
  findBrokenFormats(message).map((argument) => `  ${id}: ${argument}\n`),
);

if (found.length > 0) {
  process.stderr.write(
    `${SOURCE_CATALOG} uses ICU formats that precompiled messages render wrong (https://github.com/amannn/next-intl/issues/2447). Format these values in code:\n${found.join("")}`,
  );

  process.exitCode = 1;
}
