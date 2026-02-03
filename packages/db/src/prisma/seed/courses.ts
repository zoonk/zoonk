import { normalizeString } from "@zoonk/utils/string";
import { type PrismaClient } from "../../generated/prisma/client";
import { type SeedOrganizations } from "./orgs";

export const coursesData = [
  // English courses - only courses with chapters seeded
  {
    description:
      "A draft course for E2E testing. This course should only appear in the draft courses list.",
    imageUrl: null,
    isPublished: false,
    language: "en",
    normalizedTitle: normalizeString("E2E Draft Course"),
    slug: "e2e-draft-course",
    title: "E2E Draft Course",
  },
  {
    description:
      "Machine learning enables computers to identify patterns and make predictions from data. Covers supervised and unsupervised techniques, neural networks, and model evaluation. Prepares you to work as a machine learning engineer at tech companies, research labs, or startups building AI products.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Machine Learning"),
    slug: "machine-learning",
    title: "Machine Learning",
  },
  {
    description:
      "Proficiency in Spanish from beginner (A1) to advanced (C2), covering conversation, reading, writing, and listening comprehension. Enables communication in personal and professional contexts across Spanish-speaking countries.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/spanish-G8NTOu5F2vUzMSaJ7oa2hgKrzAQtGr.webp",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Spanish"),
    slug: "spanish",
    title: "Spanish",
  },
  {
    description:
      "Astronomy studies celestial objects, space phenomena, and the structure of the universe. Covers planets, stars, galaxies, black holes, and cosmology from observational techniques to theoretical frameworks.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Astronomy"),
    slug: "astronomy",
    title: "Astronomy",
  },
  {
    description:
      "Master Python programming from fundamentals to advanced concepts. Learn syntax, data structures, functions, object-oriented programming, and build real-world applications.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Python Programming"),
    slug: "python-programming",
    title: "Python Programming",
  },
  {
    description:
      "Build modern web applications with HTML, CSS, JavaScript, and popular frameworks. Learn frontend and backend development, APIs, and deployment strategies.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Web Development"),
    slug: "web-development",
    title: "Web Development",
  },
  {
    description:
      "Analyze and interpret complex data using statistical methods and visualization tools. Learn data wrangling, exploratory analysis, and machine learning applications.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Data Science"),
    slug: "data-science",
    title: "Data Science",
  },

  // Portuguese courses - only courses with chapters seeded
  {
    description:
      "Machine learning permite que computadores identifiquem padrões e façam previsões a partir de dados. Cobre técnicas supervisionadas e não supervisionadas, redes neurais e avaliação de modelos. Prepara você para trabalhar como engenheiro de machine learning em empresas de tecnologia, laboratórios de pesquisa ou startups.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Machine Learning"),
    slug: "machine-learning",
    title: "Machine Learning",
  },
];

const testOrgCoursesData = [
  {
    description: "A course from test-org that should not appear in ai org.",
    imageUrl: null,
    isPublished: false,
    language: "en",
    normalizedTitle: normalizeString("Test Org Course"),
    slug: "test-org-course",
    title: "Test Org Course",
  },
];

export async function seedCourses(prisma: PrismaClient, orgs: SeedOrganizations): Promise<void> {
  await Promise.all([
    ...coursesData.map((course) =>
      prisma.course.upsert({
        create: {
          organizationId: orgs.ai.id,
          ...course,
        },
        update: {},
        where: {
          orgSlug: {
            language: course.language,
            organizationId: orgs.ai.id,
            slug: course.slug,
          },
        },
      }),
    ),
    ...testOrgCoursesData.map((course) =>
      prisma.course.upsert({
        create: {
          organizationId: orgs.testOrg.id,
          ...course,
        },
        update: {},
        where: {
          orgSlug: {
            language: course.language,
            organizationId: orgs.testOrg.id,
            slug: course.slug,
          },
        },
      }),
    ),
  ]);
}
