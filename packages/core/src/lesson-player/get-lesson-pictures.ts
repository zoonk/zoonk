import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { canViewLibraryRow } from "../library/_utils/library-visibility";
import { safeParseStepContent } from "../library/steps/contract/step-contract";
import { getSession } from "../users/get-session";
import { getStepImage } from "./_utils/playable-step";
import { type LessonPicture } from "./contract";

/**
 * The pictures a lesson's screens have so far, read fresh from the database: they're drawn by a
 * workflow in another app right after the lesson opens, so a cached lesson in this app doesn't
 * have them yet. The player asks for them while a screen's picture is pending
 * (`imagePending`), for the lesson it already plays. Like the lesson's screens, they go only to
 * someone with a session (a guest's included) who can see the lesson. Empty otherwise.
 */
export async function getLessonPictures({
  lessonId,
}: {
  lessonId: string;
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
          include: { mediaAsset: true },
          orderBy: { position: "asc" },
          where: { mediaAssetId: { not: null } },
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

    const image = parsed.success
      ? getStepImage({ content: parsed.data, mediaAsset: step.mediaAsset })
      : null;

    return image ? [{ image, stepId: step.id }] : [];
  });
}
