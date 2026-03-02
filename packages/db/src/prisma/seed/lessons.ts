import { normalizeString } from "@zoonk/utils/string";
import {
  type GenerationStatus,
  type LessonKind,
  type Organization,
  type PrismaClient,
} from "../../generated/prisma/client";

const lessonsData: {
  chapterSlug: string;
  language: string;
  lessons: {
    concepts: string[];
    description: string;
    generationStatus: GenerationStatus;
    isPublished: boolean;
    kind?: LessonKind;
    slug: string;
    title: string;
  }[];
}[] = [
  {
    chapterSlug: "introduction-to-machine-learning",
    language: "en",
    lessons: [
      {
        concepts: [
          "Machine learning definition",
          "Pattern-based learning",
          "ML vs rule-based programming",
        ],
        description:
          "Learn what machine learning is and how it differs from traditional programming.",
        generationStatus: "completed",
        isPublished: true,
        slug: "what-is-machine-learning",
        title: "What is Machine Learning?",
      },
      {
        concepts: [
          "Early AI and perceptrons",
          "AI winters and setbacks",
          "Modern deep learning resurgence",
        ],
        description:
          "Explore the history of machine learning from its origins to modern developments.",
        generationStatus: "completed",
        isPublished: true,
        slug: "history-of-ml",
        title: "History of Machine Learning",
      },
      {
        concepts: [
          "Supervised learning overview",
          "Unsupervised learning overview",
          "Reinforcement learning overview",
        ],
        description: "Understand supervised, unsupervised, and reinforcement learning approaches.",
        generationStatus: "completed",
        isPublished: false,
        kind: "custom",
        slug: "types-of-learning",
        title: "Types of Learning",
      },
    ],
  },
  {
    chapterSlug: "introducao-ao-machine-learning",
    language: "pt",
    lessons: [
      {
        concepts: [
          "Definicao de machine learning",
          "Aprendizado por padroes",
          "ML vs programacao tradicional",
        ],
        description:
          "Aprenda o que é machine learning e como ele difere da programação tradicional.",
        generationStatus: "completed",
        isPublished: true,
        slug: "o-que-e-machine-learning",
        title: "O que é Machine Learning?",
      },
      {
        concepts: ["Primeiros marcos da IA", "Invernos da IA", "Renascimento do deep learning"],
        description:
          "Explore a história do machine learning desde suas origens até os desenvolvimentos modernos.",
        generationStatus: "completed",
        isPublished: true,
        slug: "historia-do-machine-learning",
        title: "História do Machine Learning",
      },
    ],
  },
  {
    chapterSlug: "data-preparation",
    language: "en",
    lessons: [
      {
        concepts: ["Tipos de dataset", "Fontes de dados", "Qualidade de dados"],
        description:
          "Learn about different types of datasets and where to find quality data for your projects.",
        generationStatus: "pending",
        isPublished: true,
        slug: "understanding-datasets",
        title: "Understanding Datasets",
      },
      {
        concepts: ["Missing values handling", "Outlier treatment", "Data normalization basics"],
        description: "Master techniques for cleaning and preprocessing raw data before training.",
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
        concepts: ["Spanish alphabet letters", "Spanish vowel sounds", "Basic pronunciation rules"],
        description: "Learn the Spanish alphabet, vowel sounds, and basic pronunciation rules.",
        generationStatus: "completed",
        isPublished: true,
        slug: "spanish-alphabet",
        title: "The Spanish Alphabet",
      },
      {
        concepts: ["Formal greetings", "Informal greetings", "Self-introduction phrases"],
        description: "Master common greetings and introductions for everyday conversations.",
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
        concepts: ["Sun structure", "Nuclear fusion in the Sun", "Sun's role in the solar system"],
        description: "Learn about the Sun, its structure, and its importance to our solar system.",
        generationStatus: "completed",
        isPublished: true,
        slug: "the-sun",
        title: "The Sun",
      },
      {
        concepts: ["Mercury characteristics", "Venus characteristics", "Earth and Mars comparison"],
        description: "Explore the inner planets: Mercury, Venus, Earth, and Mars.",
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
        concepts: ["Python installation", "Running first script", "Hello world structure"],
        description: "Set up Python on your computer and write your first Hello World program.",
        generationStatus: "completed",
        isPublished: true,
        slug: "getting-started-python",
        title: "Getting Started with Python",
      },
      {
        concepts: ["Variables in Python", "Primitive data types", "Basic operations"],
        description: "Understand variables, data types, and basic operations in Python.",
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
        concepts: ["HTML document structure", "Common HTML elements", "First web page setup"],
        description:
          "Understand HTML document structure, elements, and create your first web page.",
        generationStatus: "completed",
        isPublished: true,
        slug: "intro-to-html",
        title: "Introduction to HTML",
      },
      {
        concepts: [
          "Semantic sectioning elements",
          "Meaningful content structure",
          "Accessibility benefits of semantics",
        ],
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
        concepts: [
          "Data science definition",
          "Data scientist responsibilities",
          "Business value of data science",
        ],
        description:
          "Understand what data science is and the role of a data scientist in modern organizations.",
        generationStatus: "completed",
        isPublished: true,
        slug: "what-is-data-science",
        title: "What is Data Science?",
      },
      {
        concepts: [
          "Structured vs unstructured data",
          "Common data sources",
          "Data collection basics",
        ],
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

export async function seedLessons(prisma: PrismaClient, org: Organization): Promise<void> {
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
                concepts: lessonData.concepts,
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
