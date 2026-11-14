"use server";

import { type AccountDataExport, exportCurrentUserData } from "@zoonk/core/users/export";

export async function exportAccountDataAction(): Promise<AccountDataExport | null> {
  return exportCurrentUserData();
}
