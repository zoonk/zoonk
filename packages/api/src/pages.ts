import "server-only";

import { findPage } from "@zoonk/db/queries/pages";
import { cacheTagPage } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";

export async function getPage(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTagPage(slug));

  return findPage(slug);
}
