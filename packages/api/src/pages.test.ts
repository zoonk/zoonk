import { createPage } from "@zoonk/db/queries/pages";
import { describe, expect, test, vi } from "vitest";
import { canAddPage, getPage } from "./pages";
import * as users from "./users";

describe("getPage()", () => {
  test("retrieves a page by slug", async () => {
    const params = {
      name: "Test Page",
      slug: `test-page-${Date.now()}`,
    };

    await createPage(params);
    const page = await getPage(params.slug);

    expect(page).not.toBeNull();
    expect(page?.slug).toBe(params.slug);
    expect(page?.name).toBe(params.name);
  });
});

describe("canAddPage()", () => {
  test("returns false when there is no session", async () => {
    vi.spyOn(users, "getSession").mockResolvedValueOnce(null);

    const canAdd = await canAddPage();
    expect(canAdd).toBe(false);
  });

  test("returns true when there is a session", async () => {
    vi.spyOn(users, "getSession").mockResolvedValueOnce({ userId: 1 } as any);

    const canAdd = await canAddPage();
    expect(canAdd).toBe(true);
  });
});
