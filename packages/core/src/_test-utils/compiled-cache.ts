import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { loadBindings, transform } from "next/dist/build/swc";
import { z } from "zod";

export type CachedRead = (...args: unknown[]) => Promise<unknown>;

/** What Next's compiler turns each `"use cache"` function into a call of. */
export type CacheWrapper = (
  kind: string,
  id: string,
  boundArgs: number,
  read: CachedRead,
  args: unknown[],
) => Promise<unknown>;

/**
 * Vitest does not compile cache directives, so this compiles the module with Next's compiler and
 * runs it with `cache` standing in for one app's cache. Every other import must be in `imports`.
 */
export async function compileCachedModule({
  cache,
  globals,
  imports,
  source,
}: {
  cache: CacheWrapper;
  /** Globals the module must share with the test, such as a faked `Date`. */
  globals?: Record<string, unknown>;
  imports: Record<string, unknown>;
  source: URL;
}): Promise<Record<string, unknown>> {
  await loadBindings();

  const filename = fileURLToPath(source);

  const output: unknown = await transform(readFileSync(filename, "utf8"), {
    filename,
    jsc: { parser: { syntax: "typescript" }, target: "es2022" },
    module: { type: "commonjs" },
    serverActions: {
      cacheKinds: ["default", "private", "remote"],
      hashSalt: "core-cache-test",
      isDevelopment: false,
      isReactServerLayer: true,
      useCacheEnabled: true,
    },
  });

  const { code } = z.object({ code: z.string() }).parse(output);

  const modules: Record<string, unknown> = {
    ...imports,
    "private-next-rsc-cache-wrapper": { cache },
    "private-next-rsc-server-reference": { registerServerReference: (read: unknown) => read },
    react: { cache: (read: unknown) => read },
    "server-only": {},
  };

  const compiled: Record<string, unknown> = {};

  runInNewContext(code, {
    ...globals,
    exports: compiled,
    module: { exports: compiled },
    require: (name: string) => {
      if (!(name in modules)) {
        throw new Error(`Unexpected dependency of ${filename}: ${name}`);
      }

      return modules[name];
    },
  });

  return compiled;
}
