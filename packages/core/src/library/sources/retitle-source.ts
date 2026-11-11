import "server-only";
import { prisma } from "@zoonk/db";
import { isFileNameTitle } from "./file-name-title";

/**
 * Gives a source titled with its page's file name the document's name. A name is never replaced,
 * since learners read it in citations and statute drills match a law by it, so the write applies
 * only while the title is still the file name this read saw.
 */
export async function retitleFileNameSource({
  sourceId,
  title,
}: {
  sourceId: string;
  title: string;
}): Promise<void> {
  const source = await prisma.source.findUnique({
    select: { title: true, url: true },
    where: { id: sourceId },
  });

  if (!source || !isFileNameTitle(source) || isFileNameTitle({ title, url: source.url })) {
    return;
  }

  await prisma.source.updateMany({ data: { title }, where: { id: sourceId, title: source.title } });
}
