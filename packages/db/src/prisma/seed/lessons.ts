import { normalizeString } from "@zoonk/utils/string";
import type {
  GenerationStatus,
  LessonKind,
  Organization,
  PrismaClient,
} from "../../generated/prisma/client";

type LessonSeedData = {
  description: string;
  generationStatus: GenerationStatus;
  isPublished: boolean;
  kind?: LessonKind;
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
        generationStatus: "completed",
        isPublished: true,
        slug: "what-is-machine-learning",
        title: "What is Machine Learning?",
      },
      {
        description:
          "Explore the history of machine learning from its origins to modern developments.",
        generationStatus: "completed",
        isPublished: true,
        slug: "history-of-ml",
        title: "History of Machine Learning",
      },
      {
        description:
          "Understand supervised, unsupervised, and reinforcement learning approaches.",
        generationStatus: "completed",
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
        generationStatus: "pending",
        isPublished: true,
        slug: "understanding-datasets",
        title: "Understanding Datasets",
      },
      {
        description:
          "Master techniques for cleaning and preprocessing raw data before training.",
        generationStatus: "pending",
        isPublished: true,
        slug: "data-cleaning",
        title: "Data Cleaning",
      },
    ],
  },
  {
    chapterSlug: "spanish-basics",
    language: "en",
    lessons: [
      {
        description:
          "Learn the Spanish alphabet, vowel sounds, and basic pronunciation rules.",
        generationStatus: "completed",
        isPublished: true,
        slug: "spanish-alphabet",
        title: "The Spanish Alphabet",
      },
      {
        description:
          "Master common greetings and introductions for everyday conversations.",
        generationStatus: "pending",
        isPublished: true,
        slug: "greetings-introductions",
        title: "Greetings and Introductions",
      },
    ],
  },
  {
    chapterSlug: "solar-system",
    language: "en",
    lessons: [
      {
        description:
          "Learn about the Sun, its structure, and its importance to our solar system.",
        generationStatus: "completed",
        isPublished: true,
        slug: "the-sun",
        title: "The Sun",
      },
      {
        description:
          "Explore the inner planets: Mercury, Venus, Earth, and Mars.",
        generationStatus: "pending",
        isPublished: true,
        slug: "inner-planets",
        title: "The Inner Planets",
      },
    ],
  },
  {
    chapterSlug: "python-fundamentals",
    language: "en",
    lessons: [
      {
        description:
          "Set up Python on your computer and write your first Hello World program.",
        generationStatus: "completed",
        isPublished: true,
        slug: "getting-started-python",
        title: "Getting Started with Python",
      },
      {
        description:
          "Understand variables, data types, and basic operations in Python.",
        generationStatus: "pending",
        isPublished: true,
        slug: "variables-data-types",
        title: "Variables and Data Types",
      },
    ],
  },
  {
    chapterSlug: "html-foundations",
    language: "en",
    lessons: [
      {
        description:
          "Understand HTML document structure, elements, and create your first web page.",
        generationStatus: "completed",
        isPublished: true,
        slug: "intro-to-html",
        title: "Introduction to HTML",
      },
      {
        description:
          "Learn about semantic HTML elements and how to structure content meaningfully.",
        generationStatus: "pending",
        isPublished: true,
        slug: "semantic-html",
        title: "Semantic HTML",
      },
    ],
  },
  {
    chapterSlug: "intro-to-data-science",
    language: "en",
    lessons: [
      {
        description:
          "Understand what data science is and the role of a data scientist in modern organizations.",
        generationStatus: "completed",
        isPublished: true,
        slug: "what-is-data-science",
        title: "What is Data Science?",
      },
      {
        description:
          "Learn about different types of data, data sources, and how to collect data for analysis.",
        generationStatus: "pending",
        isPublished: true,
        slug: "types-of-data",
        title: "Types of Data",
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
                generationStatus: lessonData.generationStatus,
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
                chapterLessonSlug: {
                  chapterId: chapter.id,
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
