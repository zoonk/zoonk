import "server-only";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { prisma } from "@zoonk/db";
import {
  type ImageAnalytics,
  type LibraryPicture,
  drawLibraryImage,
} from "./_utils/draw-library-image";

type ImageRequest = NonNullable<Extract<GeneratedItem, { image: unknown }>["image"]>;

type ItemImageScope = {
  category: string | null;
  context: string;
  ownerId: string | null;
  textAllowed: boolean;
};

export function getItemImageRequest(item: GeneratedItem): ImageRequest | null {
  return "image" in item ? item.image : null;
}

function getQuestionText(item: GeneratedItem): string {
  const question = item.format === "trueFalse" ? item.statement : item.question;
  const context = "context" in item ? item.context : null;
  const options = item.format === "multipleChoice" ? item.options.map((option) => option.text) : [];

  return [context, question, ...options].filter(Boolean).join("\n");
}

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

/** Internal workflow bridge: the caller must check newly drawn pictures in the background. */
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
}): Promise<LibraryPicture | null> {
  const request = getItemImageRequest(item);

  if (!request) {
    return null;
  }

  return drawLibraryImage({
    ...scope,
    analytics,
    language,
    request: request.prompt,
    screenText: getQuestionText(item),
  });
}
