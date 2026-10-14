"use server";

import { type AccountDataExport, exportCurrentUserData } from "@zoonk/core/users/export";

/** Everything Zoonk keeps about the learner, for the download on the profile page. */
export async function exportAccountDataAction(): Promise<AccountDataExport | null> {
  return exportCurrentUserData();
}
