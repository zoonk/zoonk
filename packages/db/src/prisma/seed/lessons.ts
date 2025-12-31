import { normalizeString } from "@zoonk/utils/string";
import type { Organization, PrismaClient } from "../../generated/prisma/client";

type LessonSeedData = {
  description: string;
  isPublished: boolean;
  kind?: string;
  slug: string;
  title: string;
};

type ChapterLessons = {
  chapterSlug: string;
  language: string;
  lessons: LessonSeedData[];
};

const lessonsData: ChapterLessons[] = [
  {
    chapterSlug: "introduction-to-machine-learning",
    language: "en",
    lessons: [
      {
        description:
          "Learn what machine learning is and how it differs from traditional programming.",
        isPublished: true,
        slug: "what-is-machine-learning",
        title: "What is Machine Learning?",
      },
      {
        description:
          "Explore the history of machine learning from its origins to modern developments.",
        isPublished: true,
        slug: "history-of-ml",
        title: "History of Machine Learning",
      },
      {
        description:
          "Understand supervised, unsupervised, and reinforcement learning approaches.",
        isPublished: false,
        kind: "custom",
        slug: "types-of-learning",
        title: "Types of Learning",
      },
    ],
  },
  {
    chapterSlug: "data-preparation",
    language: "en",
    lessons: [
      {
        description:
          "Learn about different types of datasets and where to find quality data for your projects.",
        isPublished: true,
        slug: "understanding-datasets",
        title: "Understanding Datasets",
      },
      {
        description:
          "Master techniques for cleaning and preprocessing raw data before training.",
        isPublished: true,
        slug: "data-cleaning",
        title: "Data Cleaning",
      },
    ],
  },
];

export async function seedLessons(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  const allLessonPromises = lessonsData.flatMap((data) =>
    prisma.chapter
      .findFirst({
        where: {
          language: data.language,
          organizationId: org.id,
          slug: data.chapterSlug,
        },
      })
      .then(async (chapter) => {
        if (!chapter) {
          return;
        }

        await Promise.all(
          data.lessons.map((lessonData, position) =>
            prisma.lesson.upsert({
              create: {
                chapterId: chapter.id,
                description: lessonData.description,
                isPublished: lessonData.isPublished,
                kind: lessonData.kind ?? "core",
                language: data.language,
                normalizedTitle: normalizeString(lessonData.title),
                organizationId: org.id,
                position,
                slug: lessonData.slug,
                title: lessonData.title,
              },
              update: {},
              where: {
                orgLanguageLessonSlug: {
                  language: data.language,
                  organizationId: org.id,
                  slug: lessonData.slug,
                },
              },
            }),
          ),
        );
      }),
  );

  await Promise.all(allLessonPromises);
}
