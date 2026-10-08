import "server-only";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { prisma } from "@zoonk/db";
import { drawPlannedImage } from "./_utils/draw-planned-image";
import { type ImageAnalytics, planLibraryImage } from "./_utils/plan-library-image";

type ImageRequest = NonNullable<Extract<GeneratedItem, { image: unknown }>["image"]>;

/** Where a skill's pictures sit: its first course for the palette, and who may see them. */
type ItemImageScope = {
  category: string | null;
  context: string;
  ownerId: string | null;
  textAllowed: boolean;
};

/** The picture a written question asks for, or null for formats and questions without one. */
export function getItemImageRequest(item: GeneratedItem): ImageRequest | null {
  return "image" in item ? item.image : null;
}

/** What a learner reads next to the picture: the support text, the command and the options. */
function getQuestionText(item: GeneratedItem): string {
  const question = item.format === "trueFalse" ? item.statement : item.question;
  const context = "context" in item ? item.context : null;
  const options = item.format === "multipleChoice" ? item.options.map((option) => option.text) : [];

  return [context, question, ...options].filter(Boolean).join("\n");
}

/**
 * Where a skill's question pictures belong: the course its first chapter sits in (for the
 * palette and the scene's context), and its owner when the skill is private. A language skill's
 * pictures carry no text, so a label never answers the question in the practiced language.
 */
export async function loadItemImageScope(skillId: string): Promise<ItemImageScope> {
  const skill = await prisma.skill.findUniqueOrThrow({
    select: {
      chapters: {
        orderBy: { createdAt: "asc" },
        select: {
          chapter: {
            select: {
              homeCourse: {
                select: {
                  categories: {
                    orderBy: { createdAt: "asc" },
                    select: { category: true },
                    take: 1,
                  },
                  title: true,
                },
              },
              title: true,
            },
          },
        },
        take: 1,
      },
      name: true,
      ownerId: true,
      targetLanguage: true,
    },
    where: { id: skillId },
  });

  const chapter = skill.chapters[0]?.chapter;
  const course = chapter?.homeCourse;

  return {
    category: course?.categories[0]?.category ?? null,
    context: [course?.title, chapter?.title, skill.name].filter(Boolean).join(" › "),
    ownerId: skill.ownerId,
    textAllowed: skill.targetLanguage === null,
  };
}

/** A question's picture: the asset, and whether it was drawn now (its model check is still to run). */
export type ItemPicture = { assetId: string; drawn: boolean };

/**
 * Draws the picture one question asks for, the way lesson pictures are drawn: a structured scene,
 * an existing image of the same scene when there is one, or a new image. A new image is used at
 * once and checked after (`drawn`: the caller starts its check). Null when no picture could be
 * drawn, so the question is never stored without the picture it points at.
 *
 * This is a workflow bridge: it runs for Library questions a workflow is already writing.
 */
export async function drawItemImage({
  analytics,
  item,
  language,
  scope,
}: {
  analytics?: ImageAnalytics;
  item: GeneratedItem;
  language: string;
  scope: ItemImageScope;
}): Promise<ItemPicture | null> {
  const request = getItemImageRequest(item);

  if (!request) {
    return null;
  }

  const planned = await planLibraryImage({
    analytics,
    category: scope.category,
    context: scope.context,
    language,
    ownerId: scope.ownerId,
    request: request.prompt,
    screenText: getQuestionText(item),
    textAllowed: scope.textAllowed,
  });

  if (planned.kind === "existing") {
    return { assetId: planned.assetId, drawn: false };
  }

  const asset = await drawPlannedImage({ analytics, plan: planned.plan });
  return asset ? { assetId: asset.id, drawn: true } : null;
}
