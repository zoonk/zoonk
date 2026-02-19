import { normalizeString } from "@zoonk/utils/string";
import {
  type GenerationStatus,
  type Organization,
  type PrismaClient,
} from "../../generated/prisma/client";

type CourseChapters = {
  courseSlug: string;
  language: string;
  chapters: {
    description: string;
    generationStatus: GenerationStatus;
    isPublished: boolean;
    slug: string;
    title: string;
  }[];
};

const chaptersData: CourseChapters[] = [
  {
    chapters: [
      {
        description:
          "Understand what machine learning is, its history, and the different types of learning: supervised, unsupervised, and reinforcement learning.",
        generationStatus: "completed",
        isPublished: true,
        slug: "introduction-to-machine-learning",
        title: "Introduction to Machine Learning",
      },
      {
        description:
          "Learn about datasets, data preprocessing, feature engineering, and how to prepare your data for training models.",
        generationStatus: "completed",
        isPublished: true,
        slug: "data-preparation",
        title: "Data Preparation",
      },
      {
        description:
          "Explore linear regression, logistic regression, and gradient descent algorithms for predictive modeling.",
        generationStatus: "pending",
        isPublished: true,
        slug: "regression-algorithms",
        title: "Regression Algorithms",
      },
      {
        description:
          "Understand decision trees, random forests, and ensemble methods for classification and regression tasks.",
        generationStatus: "pending",
        isPublished: false,
        slug: "tree-based-models",
        title: "Tree-Based Models",
      },
      {
        description:
          "Learn the fundamentals of neural networks, activation functions, backpropagation, and deep learning architectures.",
        generationStatus: "pending",
        isPublished: false,
        slug: "neural-networks",
        title: "Neural Networks",
      },
    ],
    courseSlug: "machine-learning",
    language: "en",
  },
  {
    chapters: [
      {
        description:
          "Entenda o que é machine learning, sua história e os diferentes tipos de aprendizado: supervisionado, não supervisionado e por reforço.",
        generationStatus: "pending",
        isPublished: true,
        slug: "introducao-ao-machine-learning",
        title: "Introdução ao Machine Learning",
      },
      {
        description:
          "Aprenda sobre datasets, pré-processamento de dados, engenharia de features e como preparar seus dados para treinar modelos.",
        generationStatus: "pending",
        isPublished: true,
        slug: "preparacao-de-dados",
        title: "Preparação de Dados",
      },
      {
        description:
          "Explore regressão linear, regressão logística e algoritmos de gradiente descendente para modelagem preditiva.",
        generationStatus: "pending",
        isPublished: true,
        slug: "algoritmos-de-regressao",
        title: "Algoritmos de Regressão",
      },
      {
        description:
          "Entenda árvores de decisão, florestas aleatórias e métodos de ensemble para tarefas de classificação e regressão.",
        generationStatus: "pending",
        isPublished: false,
        slug: "modelos-baseados-em-arvores",
        title: "Modelos Baseados em Árvores",
      },
      {
        description:
          "Aprenda os fundamentos de redes neurais, funções de ativação, backpropagation e arquiteturas de deep learning.",
        generationStatus: "pending",
        isPublished: false,
        slug: "redes-neurais",
        title: "Redes Neurais",
      },
    ],
    courseSlug: "machine-learning",
    language: "pt",
  },
  {
    chapters: [
      {
        description:
          "Learn the Spanish alphabet, basic pronunciation rules, and common greetings for everyday conversations.",
        generationStatus: "completed",
        isPublished: true,
        slug: "spanish-basics",
        title: "Spanish Basics",
      },
      {
        description: "Build essential vocabulary for travel, food, family, and daily activities.",
        generationStatus: "pending",
        isPublished: true,
        slug: "essential-vocabulary",
        title: "Essential Vocabulary",
      },
    ],
    courseSlug: "spanish",
    language: "en",
  },
  {
    chapters: [
      {
        description:
          "Explore our solar system, including the Sun, planets, moons, and other celestial bodies.",
        generationStatus: "completed",
        isPublished: true,
        slug: "solar-system",
        title: "The Solar System",
      },
      {
        description:
          "Learn about stars, their life cycles, and how they form the building blocks of galaxies.",
        generationStatus: "pending",
        isPublished: true,
        slug: "stars-and-galaxies",
        title: "Stars and Galaxies",
      },
    ],
    courseSlug: "astronomy",
    language: "en",
  },
  {
    chapters: [
      {
        description: "Learn Python syntax, variables, data types, and write your first programs.",
        generationStatus: "completed",
        isPublished: true,
        slug: "python-fundamentals",
        title: "Python Fundamentals",
      },
      {
        description:
          "Master lists, dictionaries, sets, and tuples for organizing and manipulating data.",
        generationStatus: "pending",
        isPublished: true,
        slug: "data-structures",
        title: "Data Structures",
      },
    ],
    courseSlug: "python-programming",
    language: "en",
  },
  {
    chapters: [
      {
        description:
          "Learn HTML structure, semantic elements, and how to create well-organized web pages.",
        generationStatus: "completed",
        isPublished: true,
        slug: "html-foundations",
        title: "HTML Foundations",
      },
      {
        description:
          "Style your web pages with CSS, including layouts, colors, typography, and responsive design.",
        generationStatus: "pending",
        isPublished: true,
        slug: "css-styling",
        title: "CSS Styling",
      },
    ],
    courseSlug: "web-development",
    language: "en",
  },
  {
    chapters: [
      {
        description:
          "Understand data types, data sources, and the fundamentals of data analysis workflows.",
        generationStatus: "completed",
        isPublished: true,
        slug: "intro-to-data-science",
        title: "Introduction to Data Science",
      },
      {
        description:
          "Learn techniques for cleaning, transforming, and preparing data for analysis.",
        generationStatus: "pending",
        isPublished: true,
        slug: "data-wrangling",
        title: "Data Wrangling",
      },
    ],
    courseSlug: "data-science",
    language: "en",
  },
];

async function seedChaptersForCourse(
  prisma: PrismaClient,
  org: Organization,
  data: CourseChapters,
): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      language: data.language,
      organizationId: org.id,
      slug: data.courseSlug,
    },
  });

  if (!course) {
    return;
  }

  const chapterPromises = data.chapters.map(async (chapterData, position) => {
    await prisma.chapter.upsert({
      create: {
        courseId: course.id,
        description: chapterData.description,
        generationStatus: chapterData.generationStatus,
        isPublished: chapterData.isPublished,
        language: data.language,
        normalizedTitle: normalizeString(chapterData.title),
        organizationId: org.id,
        position,
        slug: chapterData.slug,
        title: chapterData.title,
      },
      update: {},
      where: {
        courseChapterSlug: {
          courseId: course.id,
          slug: chapterData.slug,
        },
      },
    });
  });

  await Promise.all(chapterPromises);
}

export async function seedChapters(prisma: PrismaClient, org: Organization): Promise<void> {
  const seedPromises = chaptersData.map((data) => seedChaptersForCourse(prisma, org, data));

  await Promise.all(seedPromises);
}
