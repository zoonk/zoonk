import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { compileFunction } from "node:vm";
import { isJsonObject } from "@zoonk/utils/json";
import { cacheTag, revalidateTag } from "next/cache";
import { loadBindings, transform } from "next/dist/build/swc";
import { vi } from "vitest";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { type readBuiltPlan } from "../_utils/read-built-plan";
import { type readPlanAnalysis } from "../_utils/read-plan-analysis";
import { chooseBases } from "../planner/base-choices";
import { buildPlan } from "../planner/build-plan";
import { getPlanFeasibility } from "../planner/plan-feasibility";

const require = createRequire(import.meta.url);

type RscEncoder = (value: unknown) => Promise<string | FormData>;
const HEX_RADIX = 16;

function loadEncoder(): RscEncoder {
  const rscModule: unknown = require("next/dist/compiled/react-server-dom-webpack/client.edge");

  if (!isJsonObject(rscModule) || typeof rscModule.encodeReply !== "function") {
    throw new Error("Installed Next must provide its RSC argument encoder");
  }

  const encode = rscModule.encodeReply;

  return async (value) => {
    const encoded: unknown = await Reflect.apply(encode, undefined, [value]);

    if (typeof encoded === "string" || encoded instanceof FormData) {
      return encoded;
    }

    throw new Error("Installed RSC must encode to its string or form data");
  };
}

const encodeReply = loadEncoder();

/** Installed RSC encoding and Next's full form-data key framing for our nonbinary planner data. */
export async function planCacheKey(value: unknown): Promise<string> {
  const encoded = await encodeReply(value);

  if (typeof encoded === "string") {
    return encoded;
  }

  return [...encoded]
    .map(([key, entry]) => {
      if (typeof entry !== "string") {
        throw new TypeError("The planner input must not contain binary request data");
      }

      return `${key.length.toString(HEX_RADIX)}:${key}${entry.length.toString(HEX_RADIX)}:${entry}`;
    })
    .join("");
}

type Entry = { result: Promise<unknown>; tags: Set<string> };
type CachedRead = (...args: unknown[]) => Promise<unknown>;

/** The unavoidable platform double, not a test of Next's real handler or HTTP prefetch lifecycle. */
function cacheBoundary() {
  const shared = new Map<string, Entry>();
  const request = new Map<string, Entry>();
  const activeTags = new AsyncLocalStorage<Set<string>>();
  const fills: string[] = [];

  const cache = async (
    kind: string,
    id: string,
    _bound: number,
    read: CachedRead,
    args: unknown[],
  ) => {
    const entries = kind === "private" ? request : shared;
    const key = await planCacheKey([id, args, ""]);

    if (!entries.has(key)) {
      const ownTags = new Set<string>();
      fills.push(kind);

      entries.set(key, {
        result: Promise.resolve().then(() => activeTags.run(ownTags, () => read(...args))),
        tags: ownTags,
      });
    }

    const entry = entries.get(key);
    const result = await entry?.result;
    entry?.tags.forEach((tag) => activeTags.getStore()?.add(tag));
    return result;
  };

  vi.mocked(cacheTag).mockImplementation((...ownTags) => {
    ownTags.forEach((tag) => activeTags.getStore()?.add(tag));
  });

  vi.mocked(revalidateTag).mockImplementation((tag) => {
    [shared, request].forEach((entries) => {
      entries.forEach((entry, key) => {
        if (entry.tags.has(tag)) {
          entries.delete(key);
        }
      });
    });
  });

  return { cache, fills, nextRequest: () => request.clear() };
}

async function compileLeaf(name: string, imports: Record<string, unknown>) {
  const filename = new URL(`../_utils/${name}.ts`, import.meta.url).pathname;

  const compiled: unknown = await transform(readFileSync(filename, "utf8"), {
    filename,
    jsc: { parser: { syntax: "typescript" }, target: "es2022" },
    module: { type: "commonjs" },
    serverActions: {
      cacheKinds: ["default", "private", "remote"],
      hashSalt: "owned-plan-cache-test",
      isDevelopment: false,
      isReactServerLayer: true,
      useCacheEnabled: true,
    },
  });

  if (!isJsonObject(compiled) || typeof compiled.code !== "string") {
    throw new Error("The installed Next compiler must return JavaScript");
  }

  const exports: Record<string, unknown> = {};

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node's VM returns Function; this compiled CommonJS module uses only the validated dependency boundary.
  const execute = compileFunction(compiled.code, ["require", "exports", "module"]) as (
    load: (path: string) => unknown,
    output: Record<string, unknown>,
    module: { exports: Record<string, unknown> },
  ) => void;

  execute(
    (path: string) => {
      if (!(path in imports)) {
        throw new Error(`Unexpected planning cache dependency: ${path}`);
      }

      return imports[path];
    },
    exports,
    { exports },
  );

  return exports;
}

/** Compiles our real leaves and executes their real pure rules over freshly loaded DB inputs. */
export async function planCachePlatform() {
  await loadBindings();
  const boundary = cacheBoundary();
  let coreSearches = 0;

  const imports: Record<string, unknown> = {
    "../../cache/tags": { getGoalsCacheTag, getLearnerModelCacheTag },
    "../planner/base-choices": { chooseBases },
    "../planner/build-plan": { buildPlan },
    "../planner/plan-feasibility": {
      getPlanFeasibility: (args: Parameters<typeof getPlanFeasibility>[0]) => {
        const actual = getPlanFeasibility(args);
        const descriptor = Object.getOwnPropertyDescriptor(actual, "coreMinutes");

        Object.defineProperty(actual, "coreMinutes", {
          get: () => {
            coreSearches += 1;
            const value: unknown = descriptor?.get?.call(actual);

            if (value === null || typeof value === "number") {
              return value;
            }

            throw new Error("The real core-time getter must return its number or null");
          },
        });

        return actual;
      },
    },
    "next/cache": { cacheTag },
    "private-next-rsc-cache-wrapper": { cache: boundary.cache },
    "private-next-rsc-server-reference": { registerServerReference: (read: unknown) => read },
    react: { cache: (read: unknown) => read },
    "server-only": {},
  };

  const built = await compileLeaf("read-built-plan", imports);

  const analysis = await compileLeaf("read-plan-analysis", {
    ...imports,
    "./read-built-plan": built,
  });

  return {
    ...boundary,
    coreSearches: () => coreSearches,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Installed SWC produces the same leaf exports; only its request/cache runtime is replaced.
    readBuiltPlan: built.readBuiltPlan as typeof readBuiltPlan,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The compiled export retains this source signature.
    readPlanAnalysis: analysis.readPlanAnalysis as typeof readPlanAnalysis,
  };
}
