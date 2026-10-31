import "server-only";
import { prisma } from "@zoonk/db";
import { type ReusePolicy } from "./source-contract";

export async function recordReusePolicy({
  policy,
  sourceId,
}: {
  policy: ReusePolicy;
  sourceId: string;
}): Promise<boolean> {
  const source = await prisma.source.findUnique({
    select: { reusePolicy: true, url: true },
    where: { id: sourceId },
  });

  if (!source || source.reusePolicy !== null) {
    return false;
  }

  await prisma.source.update({
    data: { reusePolicy: { ...policy, termsUrl: policy.termsUrl ?? source.url } },
    where: { id: sourceId },
  });

  return true;
}
