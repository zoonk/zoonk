import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetActivity = cache(async (lessonId: number, position: number) =>
  prisma.activity.findFirst({
    include: {
      steps: {
        include: {
          sentence: true,
          word: true,
        },
        orderBy: { position: "asc" },
        where: { isPublished: true },
      },
    },
    orderBy: { position: "asc" },
    where: { isPublished: true, lessonId, position },
  }),
);

export function getActivity(params: { lessonId: number; position: number }) {
  return cachedGetActivity(params.lessonId, params.position);
}
