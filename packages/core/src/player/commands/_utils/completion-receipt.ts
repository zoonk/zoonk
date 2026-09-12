import { type TransactionClient, prisma } from "@zoonk/db";
import { BELT_COLORS_ORDER } from "@zoonk/utils/belt-level";
import { z } from "zod";
import { type CompletionResult } from "../../contracts/completion-input-schema";

const resultSchema = z.object({
  belt: z.object({
    bpPerLevel: z.number(),
    bpToNextLevel: z.number(),
    color: z.enum(BELT_COLORS_ORDER),
    isMaxLevel: z.boolean(),
    level: z.number(),
    progressInLevel: z.number(),
  }),
  brainPower: z.number(),
  correctCount: z.number(),
  energyDelta: z.number(),
  incorrectCount: z.number(),
  newTotalBp: z.number(),
});

/** Original lesson identity survives curriculum replacement; only the authenticated owner may replay a receipt. */
export async function getCompletionReceipt({
  lessonId,
  startedAt,
  userId,
  database = prisma,
}: {
  lessonId: string;
  startedAt: Date;
  userId: string;
  database?: Pick<TransactionClient, "lessonCompletionReceipt">;
}): Promise<CompletionResult | null> {
  const receipt = await database.lessonCompletionReceipt.findUnique({
    where: { userOriginalLessonStartedAt: { originalLessonId: lessonId, startedAt, userId } },
  });

  return receipt ? resultSchema.parse(receipt.result) : null;
}
