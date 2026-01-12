import { toSlug } from "@zoonk/utils/string";
import type { Organization, PrismaClient } from "../../generated/prisma/client";

const alternativeTitlesData = [
  // English - Machine Learning
  {
    courseSlug: "machine-learning",
    language: "en",
    titles: [
      "ML",
      "Machine Learning Fundamentals",
      "Intro to Machine Learning",
    ],
  },
  // Portuguese - Machine Learning
  {
    courseSlug: "machine-learning",
    language: "pt",
    titles: ["ML", "Aprendizado de Máquina", "Introdução ao Machine Learning"],
  },
];

export async function seedAlternativeTitles(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  await Promise.all(
    alternativeTitlesData.map(async (item) => {
      const course = await prisma.course.findUnique({
        select: { id: true },
        where: {
          orgSlug: {
            language: item.language,
            organizationId: org.id,
            slug: item.courseSlug,
          },
        },
      });

      if (!course) {
        return;
      }

      const slugs = item.titles.map(toSlug);

      await prisma.courseAlternativeTitle.createMany({
        data: slugs.map((slug) => ({
          courseId: course.id,
          language: item.language,
          slug,
        })),
        skipDuplicates: true,
      });
    }),
  );
}
