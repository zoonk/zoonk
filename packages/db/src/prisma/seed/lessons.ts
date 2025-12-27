import { normalizeString } from "@zoonk/utils/string";
import type { Organization, PrismaClient } from "../../generated/prisma/client";

type LessonSeedData = {
  description: string;
  isPublished: boolean;
  slug: string;
  title: string;
};

type ChapterLessons = {
  chapterSlug: string;
  lessons: LessonSeedData[];
};

const lessonsData: ChapterLessons[] = [
  {
    chapterSlug: "introduction-to-machine-learning",
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
        slug: "types-of-learning",
        title: "Types of Learning",
      },
    ],
  },
  {
    chapterSlug: "data-preparation",
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
  const chapterSlugs = lessonsData.map((data) => data.chapterSlug);

  const chapters = await prisma.chapter.findMany({
    where: {
      organizationId: org.id,
      slug: { in: chapterSlugs },
    },
  });

  const chapterMap = new Map(chapters.map((c) => [c.slug, c]));

  const allLessonPromises = lessonsData.flatMap((data) => {
    const chapter = chapterMap.get(data.chapterSlug);

    if (!chapter) {
      return [];
    }

    return data.lessons.map(async (lessonData, position) => {
      const lesson = await prisma.lesson.upsert({
        create: {
          description: lessonData.description,
          isPublished: lessonData.isPublished,
          normalizedTitle: normalizeString(lessonData.title),
          organizationId: org.id,
          slug: lessonData.slug,
          title: lessonData.title,
        },
        update: {},
        where: {
          orgLessonSlug: {
            organizationId: org.id,
            slug: lessonData.slug,
          },
        },
      });

      await prisma.chapterLesson.upsert({
        create: {
          chapterId: chapter.id,
          lessonId: lesson.id,
          position,
        },
        update: {},
        where: {
          chapterLesson: {
            chapterId: chapter.id,
            lessonId: lesson.id,
          },
        },
      });
    });
  });

  await Promise.all(allLessonPromises);
}
