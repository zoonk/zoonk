import "server-only";
import { auth } from "@zoonk/auth";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { cache } from "react";
import { type AuthOrganization } from "../types";

export const listUserOrgs = cache(
  async (reqHeaders?: Headers): Promise<{ data: AuthOrganization[]; error: Error | null }> => {
    const { data, error } = await safeAsync(async () =>
      auth.api.listOrganizations({
        headers: reqHeaders ?? (await headers()),
      }),
    );

    if (error) {
      return { data: [], error };
    }

    return { data: data ?? [], error: null };
  },
);
