import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { getProxyPackageDirectory, shouldReplaceProxy, trimProxyLog } from "./proxy.mts";

test("a proxy is replaced only when an older Portless runs it", () => {
  expect(shouldReplaceProxy({ ownVersion: "0.18.1", proxyVersion: "0.17.0" })).toBe(true);
  expect(shouldReplaceProxy({ ownVersion: "0.10.0", proxyVersion: "0.9.4" })).toBe(true);
  expect(shouldReplaceProxy({ ownVersion: "0.18.1", proxyVersion: "0.18.1" })).toBe(false);
  expect(shouldReplaceProxy({ ownVersion: "0.17.0", proxyVersion: "0.18.1" })).toBe(false);
});

test("the proxy's Portless install is read from the command that runs it", () => {
  expect(
    getProxyPackageDirectory(
      "/usr/bin/node /work/zoonk/node_modules/.pnpm/portless@0.17.0/node_modules/portless/dist/cli.js proxy start --foreground --port 1355\n",
    ),
  ).toBe("/work/zoonk/node_modules/.pnpm/portless@0.17.0/node_modules/portless");

  expect(
    getProxyPackageDirectory(
      "/usr/bin/node /Users/Shared/Dev Trees/zoonk/node_modules/portless/dist/cli.js proxy start --foreground",
    ),
  ).toBe("/Users/Shared/Dev Trees/zoonk/node_modules/portless");

  expect(getProxyPackageDirectory("node /tmp/other-tool/dist/cli.js run")).toBeUndefined();

  expect(
    getProxyPackageDirectory("node /work/node_modules/portless/dist/cli.js run --name main"),
  ).toBeUndefined();
});

test("a long proxy log keeps its latest whole lines, and the running proxy keeps appending", () => {
  const directory = mkdtempSync(join(tmpdir(), "proxy-log-"));
  const logPath = join(directory, "proxy.log");
  const lines = Array.from({ length: 500_000 }, (_, index) => `Proxy error for line ${index}`);
  writeFileSync(logPath, `${lines.join("\n")}\n`);
  const proxyHandle = openSync(logPath, "a");

  try {
    trimProxyLog(logPath);
    writeSync(proxyHandle, "after the trim\n");

    const kept = readFileSync(logPath, "utf8");

    expect(kept.length).toBeLessThan(lines.join("\n").length / 2);
    expect(kept).toMatch(/^Proxy error for line \d+\n/u);
    expect(kept.endsWith("Proxy error for line 499999\nafter the trim\n")).toBe(true);
  } finally {
    closeSync(proxyHandle);
    rmSync(directory, { recursive: true });
  }
});

test("a short or missing proxy log is left alone", () => {
  const directory = mkdtempSync(join(tmpdir(), "proxy-log-"));
  const logPath = join(directory, "proxy.log");

  try {
    trimProxyLog(logPath);
    writeFileSync(logPath, "one line\n");
    trimProxyLog(logPath);

    expect(readFileSync(logPath, "utf8")).toBe("one line\n");
  } finally {
    rmSync(directory, { recursive: true });
  }
});
