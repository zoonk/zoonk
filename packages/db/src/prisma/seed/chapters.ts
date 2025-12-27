import { normalizeString } from "@zoonk/utils/string";
import type { Organization, PrismaClient } from "../../generated/prisma/client";

type ChapterSeedData = {
  description: string;
  isPublished: boolean;
  slug: string;
  title: string;
};

type LanguageChapters = {
  courseSlug: string;
  chapters: ChapterSeedData[];
};

const chaptersData: Record<string, LanguageChapters> = {
  en: {
    chapters: [
      {
        description:
          "Understand what machine learning is, its history, and the different types of learning: supervised, unsupervised, and reinforcement learning.",
        isPublished: true,
        slug: "introduction-to-machine-learning",
        title: "Introduction to Machine Learning",
      },
      {
        description:
          "Learn about datasets, data preprocessing, feature engineering, and how to prepare your data for training models.",
        isPublished: true,
        slug: "data-preparation",
        title: "Data Preparation",
      },
      {
        description:
          "Explore linear regression, logistic regression, and gradient descent algorithms for predictive modeling.",
        isPublished: true,
        slug: "regression-algorithms",
        title: "Regression Algorithms",
      },
      {
        description:
          "Understand decision trees, random forests, and ensemble methods for classification and regression tasks.",
        isPublished: false,
        slug: "tree-based-models",
        title: "Tree-Based Models",
      },
      {
        description:
          "Learn the fundamentals of neural networks, activation functions, backpropagation, and deep learning architectures.",
        isPublished: false,
        slug: "neural-networks",
        title: "Neural Networks",
      },
    ],
    courseSlug: "machine-learning",
  },
  pt: {
    chapters: [
      {
        description:
          "Entenda o que é machine learning, sua história e os diferentes tipos de aprendizado: supervisionado, não supervisionado e por reforço.",
        isPublished: true,
        slug: "introducao-ao-machine-learning",
        title: "Introdução ao Machine Learning",
      },
      {
        description:
          "Aprenda sobre datasets, pré-processamento de dados, engenharia de features e como preparar seus dados para treinar modelos.",
        isPublished: true,
        slug: "preparacao-de-dados",
        title: "Preparação de Dados",
      },
      {
        description:
          "Explore regressão linear, regressão logística e algoritmos de gradiente descendente para modelagem preditiva.",
        isPublished: true,
        slug: "algoritmos-de-regressao",
        title: "Algoritmos de Regressão",
      },
      {
        description:
          "Entenda árvores de decisão, florestas aleatórias e métodos de ensemble para tarefas de classificação e regressão.",
        isPublished: false,
        slug: "modelos-baseados-em-arvores",
        title: "Modelos Baseados em Árvores",
      },
      {
        description:
          "Aprenda os fundamentos de redes neurais, funções de ativação, backpropagation e arquiteturas de deep learning.",
        isPublished: false,
        slug: "redes-neurais",
        title: "Redes Neurais",
      },
    ],
    courseSlug: "machine-learning",
  },
};

async function seedChaptersForLanguage(
  prisma: PrismaClient,
  org: Organization,
  language: string,
  data: LanguageChapters,
): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      language,
      organizationId: org.id,
      slug: data.courseSlug,
    },
  });

  if (!course) {
    return;
  }

  const chapterPromises = data.chapters.map(async (chapterData, position) => {
    const chapter = await prisma.chapter.upsert({
      create: {
        description: chapterData.description,
        isPublished: chapterData.isPublished,
        normalizedTitle: normalizeString(chapterData.title),
        organizationId: org.id,
        slug: chapterData.slug,
        title: chapterData.title,
      },
      update: {},
      where: {
        orgChapterSlug: {
          organizationId: org.id,
          slug: chapterData.slug,
        },
      },
    });

    await prisma.courseChapter.upsert({
      create: {
        chapterId: chapter.id,
        courseId: course.id,
        position,
      },
      update: {},
      where: {
        courseChapter: {
          chapterId: chapter.id,
          courseId: course.id,
        },
      },
    });
  });

  await Promise.all(chapterPromises);
}

export async function seedChapters(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  const seedPromises = Object.entries(chaptersData).map(([language, data]) =>
    seedChaptersForLanguage(prisma, org, language, data),
  );

  await Promise.all(seedPromises);
}
