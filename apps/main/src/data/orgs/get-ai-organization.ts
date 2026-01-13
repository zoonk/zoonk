import "server-only";

import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

export async function getAIOrganization() {
  return prisma.organization.findUniqueOrThrow({
    select: { id: true },
    where: { slug: AI_ORG_SLUG },
  });
}
