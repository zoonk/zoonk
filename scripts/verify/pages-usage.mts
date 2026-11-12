import { type ParseArgsConfig } from "node:util";
import { SCHEMES, VIEWPORT_NAMES } from "./viewports.mts";

export const PAGE_OPTIONS = {
  app: { default: "main", type: "string" },
  baseline: { type: "string" },
  early: { default: false, type: "boolean" },
  email: { type: "string" },
  help: { default: false, short: "h", type: "boolean" },
  intruder: { type: "string" },
  "local-storage": { multiple: true, type: "string" },
  nav: { default: false, type: "boolean" },
  "no-prefetch": { default: false, type: "boolean" },
  out: { type: "string" },
  queries: { type: "string" },
  schemes: { default: SCHEMES.join(","), type: "string" },
  soak: { type: "string" },
  throttle: { default: false, type: "boolean" },
  url: { type: "string" },
  viewports: { default: VIEWPORT_NAMES.join(","), type: "string" },
} as const satisfies ParseArgsConfig["options"];

export const USAGE = `Usage: pnpm verify:pages [path...] [options]

Loads each path of this checkout's app (/ when none is named) on every screen size, in light and
dark, and writes a report of what it found. The verify skill's "Measuring pages" says how to read it.

  --email <address>       sign in as this learner, with the newest code in the dev mailbox
  --intruder <address>    also open every path as this other learner, who must see none of it
  --nav                   also tap from each path to the next, in order
  --no-prefetch           with --nav, block prefetches, so each tap waits on the network
  --early                 with --nav, tap as soon as content shows, before the page's code is ready
  --throttle              a mid-range phone on slow 4G; for production builds
  --baseline <dir>        compare with an earlier run's folder
  --soak <laps>           walk the paths that many times in one tab and compare memory
  --queries <file>        read the statements a server started with ZOONK_QUERY_LOG=<file> logged
  --local-storage <n=v>   set a value the page keeps on the device; repeatable
  --viewports <list>      every screen by default (${VIEWPORT_NAMES.join(", ")})
  --schemes <list>        ${SCHEMES.join(", ")} by default
  --app <name>            the app to measure: main by default, or another such as api or admin
  --url <url>             the app's URL, this checkout's by default
  --out <dir>             tmp/verify/<time> by default`;
