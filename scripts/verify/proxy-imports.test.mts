import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const ROOT = resolve(import.meta.dirname, "../..");
const EXTENSIONS = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

const relative = (file: string) => file.slice(ROOT.length + 1);

const manifestSchema = z.object({
  exports: z
    .record(z.string(), z.union([z.string(), z.object({ default: z.string().optional() })]))
    .default({}),
  name: z.string(),
});

type Exports = z.infer<typeof manifestSchema>["exports"];

const WORKSPACE_PACKAGES = new Map(
  readdirSync(join(ROOT, "packages")).flatMap((folder) => {
    const dir = join(ROOT, "packages", folder);
    const manifest = statSync(join(dir, "package.json"), { throwIfNoEntry: false });

    if (!manifest?.isFile()) {
      return [];
    }

    const { exports, name } = manifestSchema.parse(
      JSON.parse(readFileSync(join(dir, "package.json"), "utf8")),
    );

    return [[name, { dir, exports }] as const];
  }),
);

function findFile(path: string): string | undefined {
  return EXTENSIONS.map((extension) => path + extension).find((file) =>
    statSync(file, { throwIfNoEntry: false })?.isFile(),
  );
}

function exportTarget(exports: Exports, subpath: string): string | undefined {
  const target =
    exports[subpath] ??
    Object.entries(exports)
      .filter(([key]) => key.endsWith("/*") && subpath.startsWith(key.slice(0, -1)))
      .map(([key, value]) =>
        typeof value === "string" ? value.replace("*", subpath.slice(key.length - 1)) : value,
      )[0];

  return typeof target === "string" ? target : target?.default;
}

function findOwnFile({ app, from, specifier }: { app: string; from: string; specifier: string }) {
  if (specifier.startsWith(".")) {
    return findFile(resolve(dirname(from), specifier));
  }

  if (specifier.startsWith("@/")) {
    return findFile(join(ROOT, "apps", app, "src", specifier.slice(2)));
  }

  const name = /^@zoonk\/[^/]+/u.exec(specifier)?.[0];
  const workspacePackage = name ? WORKSPACE_PACKAGES.get(name) : undefined;

  if (!name || !workspacePackage) {
    return;
  }

  const target = exportTarget(workspacePackage.exports, `.${specifier.slice(name.length)}`);
  return target ? findFile(join(workspacePackage.dir, target)) : undefined;
}

/**
 * Our own files, the way the apps' bundler resolves them; a package from node_modules ends the walk.
 * One of ours it can't find fails the test, so a new kind of import can't slip past it.
 */
function resolveSource(input: { app: string; from: string; specifier: string }) {
  const isOwn = /^(?:\.|@\/|@zoonk\/)/u.test(input.specifier);
  const file = isOwn ? findOwnFile(input) : undefined;

  if (isOwn && !file) {
    throw new Error(`Can't find ${input.specifier}, imported by ${relative(input.from)}`);
  }

  return file;
}

function readImports(file: string) {
  const source = readFileSync(file, "utf8");
  const { module } = parseSync(file, source);

  const staticImports = [
    ...module.staticImports
      .filter(({ entries }) => entries.length === 0 || entries.some((entry) => !entry.isType))
      .map(({ moduleRequest }) => moduleRequest.value),
    ...module.staticExports.flatMap(({ entries }) =>
      entries.flatMap(({ isType, moduleRequest }) =>
        moduleRequest && !isType ? [moduleRequest.value] : [],
      ),
    ),
  ];

  const dynamicImports = module.dynamicImports.map(({ moduleRequest }) => {
    const request = source.slice(moduleRequest.start, moduleRequest.end);
    const path = /^["'](?<path>[^"']+)["']$/u.exec(request)?.groups?.path;

    if (!path) {
      throw new Error(`Can't follow import(${request}) in ${relative(file)}`);
    }

    return path;
  });

  return { dynamicImports, source, staticImports };
}

/**
 * The files a module loads, with the source of each. `dynamic: "everywhere"` follows every
 * `import()`, for code that runs per request; `"entry"` follows only the entry's own, for
 * `register()`, whose deeper `import()`s wait for first use.
 */
function walk({
  app,
  dynamic,
  entry,
}: {
  app: string;
  dynamic: "entry" | "everywhere";
  entry: string;
}) {
  const files = new Map<string, string>();

  function visit(file: string, isEntry: boolean) {
    if (files.has(file)) {
      return;
    }

    const { dynamicImports, source, staticImports } = readImports(file);
    files.set(file, source);

    const followed =
      dynamic === "everywhere" || isEntry ? [...staticImports, ...dynamicImports] : staticImports;

    for (const specifier of followed) {
      const imported = resolveSource({ app, from: file, specifier });

      if (imported) {
        visit(imported, false);
      }
    }
  }

  visit(join(ROOT, "apps", app, "src", entry), true);
  return files;
}

function databaseFiles(files: Map<string, string>) {
  return [...files.keys()]
    .filter((file) => file.includes("/packages/db/"))
    .map((file) => relative(file));
}

describe.each(["main", "api"])(
  "%s's proxy, which every request in every region waits on",
  (app) => {
    it("never reaches the database or another service", () => {
      const files = walk({ app, dynamic: "everywhere", entry: "proxy.ts" });

      expect(databaseFiles(files)).toStrictEqual([]);

      expect(
        [...files]
          .filter(([, source]) => /\bfetch\(/u.test(source))
          .map(([file]) => relative(file)),
      ).toStrictEqual([]);
    });

    it("starts without loading the database: register() runs before its first request", () => {
      expect(
        databaseFiles(walk({ app, dynamic: "entry", entry: "instrumentation.ts" })),
      ).toStrictEqual([]);
    });
  },
);
