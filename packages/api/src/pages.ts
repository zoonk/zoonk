import "server-only";

import { findPage, findPageMember } from "@zoonk/db/queries/pages";
import { cacheTagPage, cacheTagPageMember } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { getSession } from "./users";

export async function getPage(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTagPage({ slug }));

  return findPage(slug);
}

export async function getPageMember(params: {
  pageSlug: string;
  userId: string;
}) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTagPageMember(params));

  return findPageMember(params);
}

export const canAddPage = cache(async () => {
  const data = await getSession();
  return Boolean(data);
});

export const canEditPage = cache(async (slug: string) => {
  const userData = await getSession();

  if (!userData) {
    return false;
  }

  const pageMember = await getPageMember({
    pageSlug: slug,
    userId: userData.user.id,
  });

  return pageMember?.role === "admin";
});
