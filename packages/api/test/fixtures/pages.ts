import type { Page } from "@zoonk/db/models";
import { createPage } from "@zoonk/db/queries/pages";

export function pageAttrs(attrs?: Partial<Page>) {
  return {
    name: "Test Page",
    slug: `test-page-${Date.now()}`,
    ...attrs,
  };
}

export async function pageFixture(attrs?: Partial<Page>) {
  const params = pageAttrs(attrs);
  return createPage(params);
}
