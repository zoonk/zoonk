import "server-only";
import { prisma } from "@zoonk/db";

/** Called only with a trusted workflow start result after the generation capability authorizes its target. It does not claim or replace the active workflow. */
export async function registerGenerationRun({
  generationId,
  target,
}: {
  generationId: string;
  target:
    | { courseId: string; coursePromptId?: never }
    | { courseId?: never; coursePromptId: string };
}) {
  await prisma.generationRun.createMany({
    data: { id: generationId, ...target },
    skipDuplicates: true,
  });
}
