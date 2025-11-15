import { createPage } from "@zoonk/db/queries/pages";
import { describe, expect, test } from "vitest";
import { getPage } from "./pages";

describe("getPage()", () => {
  test("retrieves a page by slug", async () => {
    const params = {
      name: "Test Page",
      slug: `test-page-${Date.now()}`,
    };

    await createPage(params);
    const page = await getPage(params.slug);

    expect(page).toBeDefined();
    expect(page?.slug).toBe(params.slug);
    expect(page?.name).toBe(params.name);
  });
});
