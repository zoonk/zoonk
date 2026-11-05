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

/** `fetch` called, passed around or read from `globalThis`; types and imports are erased or left to the package check. */
function mentionsFetch(node: unknown): boolean {
  if (typeof node !== "object" || node === null) {
    return false;
  }

  const type = "type" in node && typeof node.type === "string" ? node.type : "";

  if (type.startsWith("TS") || type === "ImportDeclaration") {
    return false;
  }

  if (
    (type === "Identifier" && "name" in node && node.name === "fetch") ||
    (type === "Literal" && "value" in node && node.value === "fetch")
  ) {
    return true;
  }

  return Object.values(node).some((child) => mentionsFetch(child));
}

function readImports(file: string) {
  const source = readFileSync(file, "utf8");
  const { module, program } = parseSync(file, source);

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

  return { dynamicImports, fetches: mentionsFetch(program), staticImports };
}

/** Every file of ours the proxy can load, every `import()` included, and every outside import path they use. */
function walk(app: string) {
  const files = new Map<string, { fetches: boolean }>();
  const outsideImports = new Set<string>();

  function visit(file: string) {
    if (files.has(file)) {
      return;
    }

    const { dynamicImports, fetches, staticImports } = readImports(file);
    files.set(file, { fetches });

    for (const specifier of [...staticImports, ...dynamicImports]) {
      const imported = resolveSource({ app, from: file, specifier });

      if (imported) {
        visit(imported);
      } else {
        outsideImports.add(specifier);
      }
    }
  }

  visit(join(ROOT, "apps", app, "src", "proxy.ts"));
  return { files, outsideImports: [...outsideImports] };
}

/** The only outside code each proxy may import: anything else could reach a service, so it's added here on purpose. */
const PROXY_OUTSIDE_IMPORTS = {
  api: ["next/server"],
  main: [
    "@formatjs/intl-localematcher",
    "@vercel/oidc",
    "better-auth/cookies",
    "negotiator",
    "next-intl/middleware",
    "next-intl/routing",
    "next/server",
    "server-only",
  ],
};

describe.each(Object.entries(PROXY_OUTSIDE_IMPORTS))(
  "%s's proxy, which every request in every region waits on",
  (app, allowed) => {
    it("never reaches the database or another service", () => {
      const { files, outsideImports } = walk(app);

      expect(
        [...files.keys()]
          .filter((file) => file.includes("/packages/db/"))
          .map((file) => relative(file)),
      ).toStrictEqual([]);

      expect(
        [...files].filter(([, { fetches }]) => fetches).map(([file]) => relative(file)),
      ).toStrictEqual([]);

      expect(outsideImports.filter((specifier) => !allowed.includes(specifier))).toStrictEqual([]);
    });
  },
);
