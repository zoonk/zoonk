import type { Organization, PrismaClient } from "../../generated/prisma/client";
import type { SeedUsers } from "./users";

/**
 * Normalizes text for accent-insensitive search by removing accents
 * and converting to lowercase.
 */
function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const coursesData = [
  // English courses
  {
    description:
      "Machine learning enables computers to identify patterns and make predictions from data. Covers supervised and unsupervised techniques, neural networks, and model evaluation. Prepares you to work as a machine learning engineer at tech companies, research labs, or startups building AI products.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeForSearch("Machine Learning"),
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
    normalizedTitle: normalizeForSearch("Spanish"),
    slug: "spanish",
    title: "Spanish",
  },
  {
    description:
      "Astronomy studies celestial objects, space phenomena, and the structure of the universe. Covers planets, stars, galaxies, black holes, and cosmology from observational techniques to theoretical frameworks.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
    isPublished: false,
    language: "en",
    normalizedTitle: normalizeForSearch("Astronomy"),
    slug: "astronomy",
    title: "Astronomy",
  },

  // Portuguese courses
  {
    description:
      "Machine learning permite que computadores identifiquem padrões e façam previsões a partir de dados. Cobre técnicas supervisionadas e não supervisionadas, redes neurais e avaliação de modelos. Prepara você para trabalhar como engenheiro de machine learning em empresas de tecnologia, laboratórios de pesquisa ou startups.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeForSearch("Machine Learning"),
    slug: "machine-learning",
    title: "Machine Learning",
  },
  {
    description:
      "Domínio do espanhol desde iniciante (A1) até avançado (C2), cobrindo conversação, leitura, escrita e compreensão auditiva. Permite comunicação em contextos pessoais e profissionais em países de língua espanhola.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/spanish-G8NTOu5F2vUzMSaJ7oa2hgKrzAQtGr.webp",
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeForSearch("Espanhol"),
    slug: "espanhol",
    title: "Espanhol",
  },
  {
    description:
      "Astronomia estuda objetos celestes, fenômenos espaciais e a estrutura do universo. Cobre planetas, estrelas, galáxias, buracos negros e cosmologia desde técnicas observacionais até frameworks teóricos.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
    isPublished: false,
    language: "pt",
    normalizedTitle: normalizeForSearch("Astronomia"),
    slug: "astronomia",
    title: "Astronomia",
  },
];

export async function seedCourses(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
): Promise<void> {
  await Promise.all(
    coursesData.map((course) =>
      prisma.course.upsert({
        create: {
          authorId: users.owner.id,
          organizationId: org.id,
          ...course,
        },
        update: {},
        where: {
          orgSlug: {
            language: course.language,
            organizationId: org.id,
            slug: course.slug,
          },
        },
      }),
    ),
  );
}
