import { expect, test } from "vitest";
import { getPortlessPackageDirectory, shouldReplaceProxy } from "./proxy.mts";

test("a proxy is replaced only when an older or unknown Portless runs it", () => {
  expect(shouldReplaceProxy({ ownVersion: "0.18.1", proxyVersion: "0.17.0" })).toBe(true);
  expect(shouldReplaceProxy({ ownVersion: "0.10.0", proxyVersion: "0.9.4" })).toBe(true);
  expect(shouldReplaceProxy({ ownVersion: "0.18.1", proxyVersion: null })).toBe(true);
  expect(shouldReplaceProxy({ ownVersion: "0.18.1", proxyVersion: "0.18.1" })).toBe(false);
  expect(shouldReplaceProxy({ ownVersion: "0.17.0", proxyVersion: "0.18.1" })).toBe(false);
});

test("the proxy's Portless install is read from the command that runs it", () => {
  expect(
    getPortlessPackageDirectory(
      "/usr/bin/node /work/zoonk/node_modules/.pnpm/portless@0.17.0/node_modules/portless/dist/cli.js proxy start --foreground --port 1355",
    ),
  ).toBe("/work/zoonk/node_modules/.pnpm/portless@0.17.0/node_modules/portless");

  expect(getPortlessPackageDirectory("/usr/bin/python3 -m http.server")).toBeUndefined();
});
