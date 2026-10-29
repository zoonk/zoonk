import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SANDBOX_PAGE_FILE, sandboxPage } from "./sandbox-html.mts";

describe(sandboxPage, () => {
  it("matches the committed page; run `pnpm --filter android sandbox` after main's sandbox changes", async () => {
    expect(readFileSync(SANDBOX_PAGE_FILE, "utf8")).toBe(await sandboxPage());
  });
});
