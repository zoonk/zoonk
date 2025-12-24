import "server-only";

import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import type { Organization } from "../types";

export const getOrganization = cache(
  async (slug: string): Promise<SafeReturn<Organization | null>> => {
    const { data: org, error } = await safeAsync(() =>
      prisma.organization.findUnique({ where: { slug } }),
    );

    if (error) {
      return { data: null, error };
    }

    return { data: org ?? null, error: null };
  },
);
