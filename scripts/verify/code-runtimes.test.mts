import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const ROOT = resolve(import.meta.dirname, "../..");

const PLAYER_SANDBOX = "packages/player/src/activities/_sandbox/sandbox-sources.ts";
const APPLE_WORKERS = "apps/apple/Zoonk/Features/Activities/Code/CodeWorkerSources.swift";

const PYODIDE_URL = /cdn\.jsdelivr\.net\/pyodide\/v(?<version>[^/]+)\//gu;
const SQL_JS_URL = /cdn\.jsdelivr\.net\/npm\/sql\.js@(?<version>[^/]+)\//gu;

const manifestSchema = z.object({ version: z.string() });

const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

function coreVersion(name: string): string {
  const manifest = read(`packages/core/node_modules/${name}/package.json`);
  return manifestSchema.parse(JSON.parse(manifest)).version;
}

describe("code runtimes pinned in jsDelivr URLs", () => {
  it.each([
    { file: PLAYER_SANDBOX, runtime: "pyodide", url: PYODIDE_URL },
    { file: PLAYER_SANDBOX, runtime: "sql.js", url: SQL_JS_URL },
    { file: APPLE_WORKERS, runtime: "pyodide", url: PYODIDE_URL },
  ])(
    "$file loads core's $runtime, which checks programs on the server",
    ({ file, runtime, url }) => {
      const pinned = [...read(file).matchAll(url)].map((match) => match.groups?.version);
      expect(pinned).toStrictEqual([coreVersion(runtime)]);
    },
  );
});
