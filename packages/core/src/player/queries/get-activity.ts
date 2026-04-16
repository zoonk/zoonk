import "server-only";
import { getPublishedActivityWhere, getPublishedStepWhere, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetActivity = cache(async (lessonId: string, position: number) =>
  prisma.activity.findFirst({
    include: {
      steps: {
        include: { sentence: true, word: true },
        orderBy: { position: "asc" },
        where: getPublishedStepWhere(),
      },
    },
    orderBy: { position: "asc" },
    where: getPublishedActivityWhere({
      activityWhere: { lessonId, position },
    }),
  }),
);

export function getActivity(params: { lessonId: string; position: number }) {
  return cachedGetActivity(params.lessonId, params.position);
}
