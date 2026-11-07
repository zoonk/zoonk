import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";

const scoredSchema = z.object({
  areas: z.array(z.object({ answers: z.array(z.boolean()), label: z.string(), name: z.string() })),
  focusAreas: z.array(z.string()),
});

export type FocusTestReceipt = z.infer<typeof scoredSchema> & {
  /** The plan change that set the focus; null when it changed nothing. */
  changeId: string | null;
};

export function toFocusTestContentIds({
  areas,
  changeId,
  focusAreas,
  requestId,
}: FocusTestReceipt & { requestId: string }): Record<string, string> {
  return {
    focusTestId: requestId,
    focusTestScore: JSON.stringify({ areas, focusAreas }),
    ...(changeId ? { planChangeId: changeId } : {}),
  };
}

function readFocusTestReceipt(contentIds: unknown): FocusTestReceipt {
  const content = isJsonObject(contentIds) ? contentIds : {};
  const score = typeof content.focusTestScore === "string" ? content.focusTestScore : "{}";

  return {
    ...scoredSchema.parse(JSON.parse(score)),
    changeId: typeof content.planChangeId === "string" ? content.planChangeId : null,
  };
}

export async function findFocusTestReceipt({
  goalId,
  requestId,
  userId,
}: {
  goalId: string;
  requestId: string;
  userId: string;
}): Promise<FocusTestReceipt | null> {
  const event = await prisma.learningEvent.findFirst({
    select: { contentIds: true },
    where: {
      contentIds: { equals: requestId, path: ["focusTestId"] },
      goalId,
      lessonKind: "focusTest",
      userId,
    },
  });

  return event ? readFocusTestReceipt(event.contentIds) : null;
}
