import type { Organization, PrismaClient } from "../../generated/prisma/client";
import { coursesData } from "./courses";

type CourseCategoryData = {
  courseSlug: string;
  language: string;
  categories: string[];
};

const categoriesData: CourseCategoryData[] = [
  {
    categories: ["tech", "math", "science"],
    courseSlug: "machine-learning",
    language: "en",
  },
  {
    categories: ["languages", "culture", "communication"],
    courseSlug: "spanish",
    language: "en",
  },
  {
    categories: ["science", "geography"],
    courseSlug: "astronomy",
    language: "en",
  },
  {
    categories: ["tech", "math", "science"],
    courseSlug: "machine-learning",
    language: "pt",
  },
  {
    categories: ["languages", "culture", "communication"],
    courseSlug: "espanhol",
    language: "pt",
  },
  {
    categories: ["science", "geography"],
    courseSlug: "astronomia",
    language: "pt",
  },
];

export async function seedCategories(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  const courses = await prisma.course.findMany({
    select: { id: true, language: true, slug: true },
    where: {
      organizationId: org.id,
      slug: { in: coursesData.map((c) => c.slug) },
    },
  });

  const categoryRecords = categoriesData.flatMap((data) => {
    const course = courses.find(
      (c) => c.slug === data.courseSlug && c.language === data.language,
    );

    if (!course) {
      return [];
    }

    return data.categories.map((category) => ({
      category,
      courseId: course.id,
    }));
  });

  await Promise.all(
    categoryRecords.map((record) =>
      prisma.courseCategory.upsert({
        create: record,
        update: {},
        where: {
          courseCategory: {
            category: record.category,
            courseId: record.courseId,
          },
        },
      }),
    ),
  );
}
