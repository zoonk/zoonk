import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function getOrganizationId(
  slug: string,
): Promise<SafeReturn<number | null>> {
  const { data: org, error } = await safeAsync(() =>
    prisma.organization.findUnique({
      select: { id: true },
      where: { slug },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: org?.id ?? null, error: null };
}
