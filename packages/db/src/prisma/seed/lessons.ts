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
          "definition of machine learning",
          "traditional programming vs ML",
          "training data",
          "model predictions",
          "pattern recognition",
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
          "origins of artificial intelligence",
          "perceptron model",
          "neural network winter",
          "deep learning revolution",
          "modern ML milestones",
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
          "supervised learning",
          "unsupervised learning",
          "reinforcement learning",
          "labeled vs unlabeled data",
          "reward-based training",
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
          "definição de machine learning",
          "programação tradicional vs ML",
          "dados de treinamento",
          "previsões de modelo",
          "reconhecimento de padrões",
        ],
        description:
          "Aprenda o que é machine learning e como ele difere da programação tradicional.",
        generationStatus: "completed",
        isPublished: true,
        slug: "o-que-e-machine-learning",
        title: "O que é Machine Learning?",
      },
      {
        concepts: [
          "origens da inteligência artificial",
          "modelo perceptron",
          "inverno das redes neurais",
          "revolução do deep learning",
          "marcos modernos do ML",
        ],
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
        concepts: [
          "structured vs unstructured data",
          "public datasets",
          "data quality metrics",
          "dataset size considerations",
        ],
        description:
          "Learn about different types of datasets and where to find quality data for your projects.",
        generationStatus: "pending",
        isPublished: true,
        slug: "understanding-datasets",
        title: "Understanding Datasets",
      },
      {
        concepts: [
          "handling missing values",
          "outlier detection",
          "data normalization",
          "feature encoding",
          "data validation",
        ],
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
        concepts: [
          "Spanish vowel sounds",
          "consonant pronunciation",
          "letter ñ",
          "accent marks",
          "alphabet song",
        ],
        description: "Learn the Spanish alphabet, vowel sounds, and basic pronunciation rules.",
        generationStatus: "completed",
        isPublished: true,
        slug: "spanish-alphabet",
        title: "The Spanish Alphabet",
      },
      {
        concepts: [
          "hola and adiós",
          "formal vs informal greetings",
          "introducing yourself",
          "asking someone's name",
        ],
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
        concepts: [
          "solar structure",
          "nuclear fusion",
          "solar energy output",
          "Sun's life cycle",
          "solar wind",
        ],
        description: "Learn about the Sun, its structure, and its importance to our solar system.",
        generationStatus: "completed",
        isPublished: true,
        slug: "the-sun",
        title: "The Sun",
      },
      {
        concepts: [
          "Mercury's orbit",
          "Venus atmosphere",
          "Earth's water",
          "Mars surface features",
          "rocky planet characteristics",
        ],
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
        concepts: [
          "Python installation",
          "REPL environment",
          "Hello World program",
          "running Python scripts",
        ],
        description: "Set up Python on your computer and write your first Hello World program.",
        generationStatus: "completed",
        isPublished: true,
        slug: "getting-started-python",
        title: "Getting Started with Python",
      },
      {
        concepts: [
          "variable assignment",
          "integers and floats",
          "strings",
          "booleans",
          "type conversion",
          "arithmetic operators",
        ],
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
        concepts: [
          "HTML document structure",
          "tags and elements",
          "head vs body",
          "creating a web page",
          "HTML attributes",
        ],
        description:
          "Understand HTML document structure, elements, and create your first web page.",
        generationStatus: "completed",
        isPublished: true,
        slug: "intro-to-html",
        title: "Introduction to HTML",
      },
      {
        concepts: [
          "semantic elements",
          "header and footer tags",
          "article and section",
          "accessibility benefits",
          "SEO impact",
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
          "data science definition",
          "data scientist role",
          "data science vs statistics",
          "business applications of data science",
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
          "quantitative vs qualitative data",
          "primary vs secondary data",
          "data collection methods",
          "data sources",
          "sampling techniques",
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
