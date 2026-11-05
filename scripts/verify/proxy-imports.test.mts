import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const EXTENSIONS = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

type Exports = Record<string, string | { default?: string }>;

const WORKSPACE_PACKAGES = new Map(
  readdirSync(join(ROOT, "packages")).flatMap((folder) => {
    const dir = join(ROOT, "packages", folder);
    const manifest = statSync(join(dir, "package.json"), { throwIfNoEntry: false });

    if (!manifest?.isFile()) {
      return [];
    }

    const { exports = {}, name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      exports?: Exports;
      name: string;
    };

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

/** Our own files only, the way the apps' bundler resolves them; packages from node_modules stop the walk. */
function resolveSource({ app, from, specifier }: { app: string; from: string; specifier: string }) {
  if (specifier.startsWith(".")) {
    return findFile(resolve(dirname(from), specifier));
  }

  if (specifier.startsWith("@/")) {
    return findFile(join(ROOT, "apps", app, "src", specifier.slice(2)));
  }

  const name = /^@zoonk\/[^/]+/u.exec(specifier)?.[0];
  const workspacePackage = name && WORKSPACE_PACKAGES.get(name);

  if (!name || !workspacePackage) {
    return undefined;
  }

  const target = exportTarget(workspacePackage.exports, `.${specifier.slice(name.length)}`);
  return target && findFile(join(workspacePackage.dir, target));
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

  const dynamicImports = module.dynamicImports.flatMap(({ moduleRequest }) => {
    const literal = /^["'](?<path>[^"']+)["']$/u.exec(
      source.slice(moduleRequest.start, moduleRequest.end),
    );

    return literal?.groups?.path ? [literal.groups.path] : [];
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
  const pending = [join(ROOT, "apps", app, "src", entry)];

  for (let file = pending.pop(); file; file = pending.pop()) {
    if (files.has(file)) {
      continue;
    }

    const { dynamicImports, source, staticImports } = readImports(file);
    const isEntry = files.size === 0;
    files.set(file, source);

    const followed =
      dynamic === "everywhere" || isEntry ? [...staticImports, ...dynamicImports] : staticImports;

    pending.push(
      ...followed.flatMap((specifier) => resolveSource({ app, from: file, specifier }) ?? []),
    );
  }

  return files;
}

const relative = (file: string) => file.slice(ROOT.length + 1);

function databaseFiles(files: Map<string, string>) {
  return [...files.keys()].filter((file) => file.includes("/packages/db/")).map(relative);
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
