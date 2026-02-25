import { type Organization, type PrismaClient } from "../../generated/prisma/client";
import { coursesData } from "./courses";

const categoriesData: {
  courseSlug: string;
  language: string;
  categories: string[];
}[] = [
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
    courseSlug: "machine-learning-pt",
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

export async function seedCategories(prisma: PrismaClient, org: Organization): Promise<void> {
  const courses = await prisma.course.findMany({
    select: { id: true, language: true, slug: true },
    where: {
      organizationId: org.id,
      slug: { in: coursesData.map((course) => course.slug) },
    },
  });

  const categoryRecords = categoriesData.flatMap((data) => {
    const course = courses.find((item) => item.slug === data.courseSlug);

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
