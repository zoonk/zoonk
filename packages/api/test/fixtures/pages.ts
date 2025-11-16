import type { Page, PageMemberRole } from "@zoonk/db/models";
import { createPage, createPageMember } from "@zoonk/db/queries/pages";

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

export async function pageMemberFixture(attrs: {
  pageId: number;
  userId: string;
  role?: PageMemberRole;
}) {
  return createPageMember({
    pageId: attrs.pageId,
    role: attrs.role || "editor",
    userId: attrs.userId,
  });
}
