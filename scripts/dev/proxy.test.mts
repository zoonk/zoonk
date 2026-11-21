import { expect, test } from "vitest";
import { getProxyPackageDirectory, shouldReplaceProxy } from "./proxy.mts";

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
