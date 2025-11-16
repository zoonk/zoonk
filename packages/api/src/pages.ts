import "server-only";

import { findPage } from "@zoonk/db/queries/pages";
import { cacheTagPage } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getSession } from "./users";

export async function getPage(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTagPage(slug));

  const page = await findPage(slug);
  return page;
}

export async function canAddPage() {
  const data = await getSession();
  return Boolean(data);
}
