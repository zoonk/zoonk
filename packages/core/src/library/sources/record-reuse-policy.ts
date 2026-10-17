import "server-only";
import { prisma } from "@zoonk/db";
import { type ReusePolicy } from "./source-contract";

/**
 * Stores the reuse terms research read in a board's own documents. A policy
 * already on the source (a board checked by hand) is kept, since a model's
 * reading of terms is weaker evidence.
 */
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
