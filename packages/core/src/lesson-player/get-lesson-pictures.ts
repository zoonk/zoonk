import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { canViewLibraryRow } from "../library/_utils/library-visibility";
import { safeParseStepContent } from "../library/steps/contract/step-contract";
import { getSession } from "../users/get-session";
import { getOptionPictures, getStepImage } from "./_utils/screen-pictures";
import { type LessonPicture } from "./playable-lesson";

/** Fresh read for stepIds only; returns empty unless a learner or guest session can see the lesson. */
export async function getLessonPictures({
  lessonId,
  stepIds,
}: {
  lessonId: string;
  stepIds?: readonly string[];
}): Promise<LessonPicture[]> {
  if (!isUuid(lessonId)) {
    return [];
  }

  const [session, lesson] = await Promise.all([
    getSession(),
    prisma.lesson.findUnique({
      select: {
        ownerId: true,
        steps: {
          include: { mediaAsset: true, optionPictures: { include: { mediaAsset: true } } },
          orderBy: { position: "asc" },
          where: {
            OR: [{ mediaAssetId: { not: null } }, { optionPictures: { some: {} } }],
            ...(stepIds ? { id: { in: [...stepIds] } } : {}),
          },
        },
        visibility: true,
      },
      where: { id: lessonId },
    }),
  ]);

  if (!session || !lesson || !(await canViewLibraryRow(lesson))) {
    return [];
  }

  return lesson.steps.flatMap((step) => {
    const parsed = safeParseStepContent(step.kind, step.content);

    if (!parsed.success) {
      return [];
    }

    const image = getStepImage({
      content: parsed.data,
      kind: step.kind,
      mediaAsset: step.mediaAsset,
    });

    const options = getOptionPictures({
      content: parsed.data,
      kind: step.kind,
      pictures: step.optionPictures,
    });

    return [
      ...(image ? [{ image, stepId: step.id }] : []),
      ...Object.entries(options).map(([optionId, picture]) => ({
        image: picture,
        optionId,
        stepId: step.id,
      })),
    ];
  });
}
