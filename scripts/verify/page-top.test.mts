import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { readPageTopClasses } from "./page-top.mts";

describe("shared page-top measurement inputs", () => {
  it("reads changed spacing classes from the measured checkout", () => {
    const checkout = mkdtempSync(join(tmpdir(), "page-top-"));
    const components = join(checkout, "packages/ui/src/components");

    try {
      assert.equal(readPageTopClasses(checkout), null);
      mkdirSync(components, { recursive: true });

      writeFileSync(
        join(components, "page-header-class.tsx"),
        'export const PAGE_HEADER_CLASS = "flex pt-2";',
      );

      writeFileSync(
        join(components, "page-top.tsx"),
        `function PageTopBar() {
        return <div className={cn("border-b pt-5 pb-3", scrolled)} data-slot="page-top-bar">
          <div className="flex min-h-12 items-center" />
        </div>;
      }
      function PageTop() {}`,
      );

      assert.deepEqual(readPageTopClasses(checkout), {
        bar: "border-b pt-5 pb-3",
        header: "flex pt-2",
        row: "flex min-h-12 items-center",
      });

      writeFileSync(join(components, "page-top.tsx"), "function PageTopBar() {}");
      assert.throws(() => readPageTopClasses(checkout), /Cannot read PageTopBar/u);
    } finally {
      rmSync(checkout, { force: true, recursive: true });
    }
  });
});
