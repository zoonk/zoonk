"use server";

import { searchAdminRecords } from "@/data/search/search-admin-records";
import { assertAdmin } from "@/lib/admin-guard";

export async function searchAdminAction(query: string) {
  await assertAdmin();
  const search = query.trim().slice(0, 100);

  if (search.length < 2) {
    return [];
  }

  return searchAdminRecords(search);
}
