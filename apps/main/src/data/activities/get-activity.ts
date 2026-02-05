import "server-only";
import { type ActivityKind, type GenerationStatus, prisma } from "@zoonk/db";
import { cache } from "react";

export type ActivityWithSteps = {
  id: bigint;
  kind: ActivityKind;
  title: string | null;
  description: string | null;
  position: number;
  generationStatus: GenerationStatus;
  generationRunId: string | null;
  steps: {
    id: bigint;
    content: unknown;
    kind: string;
    position: number;
    visualContent: unknown;
    visualKind: string | null;
  }[];
};

const cachedGetActivity = cache(
  async (lessonId: number, position: number): Promise<ActivityWithSteps | null> =>
    prisma.activity.findFirst({
      orderBy: { position: "asc" },
      select: {
        description: true,
        generationRunId: true,
        generationStatus: true,
        id: true,
        kind: true,
        position: true,
        steps: {
          orderBy: { position: "asc" },
          select: {
            content: true,
            id: true,
            kind: true,
            position: true,
            visualContent: true,
            visualKind: true,
          },
        },
        title: true,
      },
      where: { isPublished: true, lessonId, position },
    }),
);

export function getActivity(params: {
  lessonId: number;
  position: number;
}): Promise<ActivityWithSteps | null> {
  return cachedGetActivity(params.lessonId, params.position);
}
