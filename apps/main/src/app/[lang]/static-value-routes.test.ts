import { readFileSync, readdirSync } from "node:fs";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { BILLING_CURRENCIES, DEFAULT_CURRENCY } from "@zoonk/utils/currency";
import { describe, expect, it } from "vitest";

function getRouteFolders(parent: string) {
  const directory = new URL(parent, import.meta.url);

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      page: readFileSync(new URL(`${entry.name}/page.tsx`, directory), "utf8"),
    }))
    .toSorted((first, second) => first.name.localeCompare(second.name));
}

describe("static routes for each known value", () => {
  it("has a page for exactly every course category, each showing its own", () => {
    const folders = getRouteFolders("./(app)/(catalog)/courses/");

    expect(folders.map((folder) => folder.name)).toStrictEqual(COURSE_CATEGORIES.toSorted());

    const showingAnother = folders.filter(
      ({ name, page }) =>
        !page.includes(`category="${name}"`) ||
        !page.includes(`getCategoryPageMetadata("${name}")`),
    );

    expect(showingAnother.map((folder) => folder.name)).toStrictEqual([]);
  });

  it("has a pricing variant for exactly every billing currency but the default (/pricing itself), each in its own", () => {
    const folders = getRouteFolders("./pricing/");

    expect(folders.map((folder) => folder.name)).toStrictEqual(
      BILLING_CURRENCIES.filter((currency) => currency !== DEFAULT_CURRENCY).toSorted(),
    );

    const inAnother = folders.filter(({ name, page }) => !page.includes(`currency="${name}"`));
    expect(inAnother.map((folder) => folder.name)).toStrictEqual([]);
  });
});
