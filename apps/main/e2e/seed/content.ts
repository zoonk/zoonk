import type { Organization, Prisma, PrismaClient } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import type { E2EUsers } from "./users";

// Course data
const coursesData = [
  {
    description:
      "Machine learning enables computers to identify patterns and make predictions from data.",
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
      "Proficiency in Spanish from beginner to advanced, covering conversation, reading, and writing.",
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
      "Astronomy studies celestial objects, space phenomena, and the structure of the universe.",
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
      "Master Python programming from fundamentals to advanced concepts.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Python Programming"),
    slug: "python-programming",
    title: "Python Programming",
  },
  {
    description:
      "Build modern web applications with HTML, CSS, JavaScript, and popular frameworks.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Web Development"),
    slug: "web-development",
    title: "Web Development",
  },
  {
    description:
      "Analyze and interpret complex data using statistical methods and visualization tools.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Data Science"),
    slug: "data-science",
    title: "Data Science",
  },
  {
    description:
      "Machine learning permite que computadores identifiquem padrões e façam previsões a partir de dados.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Machine Learning"),
    slug: "machine-learning",
    title: "Machine Learning",
  },
  {
    description: "Domínio do espanhol desde iniciante até avançado.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/spanish-G8NTOu5F2vUzMSaJ7oa2hgKrzAQtGr.webp",
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Espanhol"),
    slug: "espanhol",
    title: "Espanhol",
  },
  {
    description: "Astronomia estuda objetos celestes e fenômenos espaciais.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
    isPublished: false,
    language: "pt",
    normalizedTitle: normalizeString("Astronomia"),
    slug: "astronomia",
    title: "Astronomia",
  },
];

// Chapter data
type ChapterSeedData = {
  description: string;
  isPublished: boolean;
  slug: string;
  title: string;
};

type CourseChapters = {
  courseSlug: string;
  language: string;
  chapters: ChapterSeedData[];
};

const chaptersData: CourseChapters[] = [
  {
    chapters: [
      {
        description:
          "Understand what machine learning is and its different types.",
        isPublished: true,
        slug: "introduction-to-machine-learning",
        title: "Introduction to Machine Learning",
      },
      {
        description: "Learn about datasets and data preprocessing.",
        isPublished: true,
        slug: "data-preparation",
        title: "Data Preparation",
      },
      {
        description: "Explore linear and logistic regression algorithms.",
        isPublished: true,
        slug: "regression-algorithms",
        title: "Regression Algorithms",
      },
      {
        description: "Understand decision trees and random forests.",
        isPublished: false,
        slug: "tree-based-models",
        title: "Tree-Based Models",
      },
      {
        description: "Learn the fundamentals of neural networks.",
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
        description: "Learn the Spanish alphabet and pronunciation.",
        isPublished: true,
        slug: "spanish-basics",
        title: "Spanish Basics",
      },
      {
        description: "Build essential vocabulary for daily activities.",
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
        description: "Explore our solar system including the Sun and planets.",
        isPublished: true,
        slug: "solar-system",
        title: "The Solar System",
      },
      {
        description: "Learn about stars and galaxies.",
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
        description: "Learn Python syntax and data types.",
        isPublished: true,
        slug: "python-fundamentals",
        title: "Python Fundamentals",
      },
      {
        description: "Master lists, dictionaries, and sets.",
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
        description: "Learn HTML structure and semantic elements.",
        isPublished: true,
        slug: "html-foundations",
        title: "HTML Foundations",
      },
      {
        description: "Style web pages with CSS.",
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
        description: "Understand data types and analysis workflows.",
        isPublished: true,
        slug: "intro-to-data-science",
        title: "Introduction to Data Science",
      },
      {
        description: "Learn data cleaning and transformation.",
        isPublished: true,
        slug: "data-wrangling",
        title: "Data Wrangling",
      },
    ],
    courseSlug: "data-science",
    language: "en",
  },
];

// Lesson data
type LessonSeedData = {
  description: string;
  isPublished: boolean;
  kind?: string;
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
        description: "Learn what machine learning is.",
        isPublished: true,
        slug: "what-is-machine-learning",
        title: "What is Machine Learning?",
      },
      {
        description: "Explore the history of machine learning.",
        isPublished: true,
        slug: "history-of-ml",
        title: "History of Machine Learning",
      },
      {
        description:
          "Understand supervised, unsupervised, and reinforcement learning.",
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
        description: "Learn about different types of datasets.",
        isPublished: true,
        slug: "understanding-datasets",
        title: "Understanding Datasets",
      },
      {
        description: "Master data cleaning techniques.",
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
        description: "Learn the Spanish alphabet.",
        isPublished: true,
        slug: "spanish-alphabet",
        title: "The Spanish Alphabet",
      },
      {
        description: "Master common greetings.",
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
        description: "Learn about the Sun.",
        isPublished: true,
        slug: "the-sun",
        title: "The Sun",
      },
      {
        description: "Explore the inner planets.",
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
        description: "Set up Python and write your first program.",
        isPublished: true,
        slug: "getting-started-python",
        title: "Getting Started with Python",
      },
      {
        description: "Understand variables and data types.",
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
        description: "Understand HTML structure.",
        isPublished: true,
        slug: "intro-to-html",
        title: "Introduction to HTML",
      },
      {
        description: "Learn semantic HTML elements.",
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
        description: "Understand what data science is.",
        isPublished: true,
        slug: "what-is-data-science",
        title: "What is Data Science?",
      },
      {
        description: "Learn about different types of data.",
        isPublished: true,
        slug: "types-of-data",
        title: "Types of Data",
      },
    ],
  },
];

// Activity data
type ActivitySeedData = {
  isPublished: boolean;
  kind: string;
  title?: string;
  description?: string;
  inventory?: Record<string, number>;
  winCriteria?: Record<string, { operator: string; value: number }>;
};

type LessonActivities = {
  lessonSlug: string;
  language: string;
  activities: ActivitySeedData[];
};

const activitiesData: LessonActivities[] = [
  {
    activities: [
      { isPublished: true, kind: "background" },
      { isPublished: true, kind: "explanation" },
      { isPublished: true, kind: "explanation_quiz" },
      { isPublished: true, kind: "examples" },
      { isPublished: true, kind: "story" },
      { isPublished: true, kind: "logic" },
      {
        inventory: {
          computeResources: 70,
          dataQuality: 50,
          modelAccuracy: 60,
          teamMorale: 80,
        },
        isPublished: true,
        kind: "challenge",
        winCriteria: {
          computeResources: { operator: ">=", value: 50 },
          dataQuality: { operator: ">=", value: 65 },
          modelAccuracy: { operator: ">=", value: 75 },
          teamMorale: { operator: ">=", value: 60 },
        },
      },
      { isPublished: true, kind: "lesson_quiz" },
    ],
    language: "en",
    lessonSlug: "what-is-machine-learning",
  },
  {
    activities: [
      { isPublished: true, kind: "background" },
      { isPublished: true, kind: "explanation" },
    ],
    language: "en",
    lessonSlug: "history-of-ml",
  },
  {
    activities: [
      { isPublished: true, kind: "background" },
      { isPublished: true, kind: "explanation" },
    ],
    language: "en",
    lessonSlug: "spanish-alphabet",
  },
  {
    activities: [
      { isPublished: true, kind: "background" },
      { isPublished: true, kind: "explanation" },
    ],
    language: "en",
    lessonSlug: "the-sun",
  },
  {
    activities: [
      { isPublished: true, kind: "background" },
      { isPublished: true, kind: "explanation" },
    ],
    language: "en",
    lessonSlug: "getting-started-python",
  },
  {
    activities: [
      { isPublished: true, kind: "background" },
      { isPublished: true, kind: "explanation" },
    ],
    language: "en",
    lessonSlug: "intro-to-html",
  },
  {
    activities: [
      { isPublished: true, kind: "background" },
      { isPublished: true, kind: "explanation" },
    ],
    language: "en",
    lessonSlug: "what-is-data-science",
  },
];

// Step data
type StepSeedData = {
  kind: string;
  content: Prisma.InputJsonValue;
  visualKind?: string;
  visualContent?: Prisma.InputJsonValue;
};

type ActivitySteps = {
  lessonSlug: string;
  language: string;
  activityPosition: number;
  steps: StepSeedData[];
};

const stepsData: ActivitySteps[] = [
  {
    activityPosition: 0,
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          text: "In 1956, scientists gathered at Dartmouth College to create machines that could think.",
          title: "The Birth of AI",
        },
        kind: "static",
        visualContent: {
          events: [
            {
              date: "1956",
              description: "AI term coined.",
              title: "Dartmouth",
            },
            {
              date: "1997",
              description: "Deep Blue wins chess.",
              title: "IBM",
            },
            {
              date: "2012",
              description: "Deep learning breakthrough.",
              title: "Revolution",
            },
          ],
        },
        visualKind: "timeline",
      },
      {
        content: {
          text: "Traditional programming required explicit rules. ML lets computers learn patterns.",
          title: "The Problem",
        },
        kind: "static",
        visualContent: {
          edges: [
            { from: "input", to: "output" },
            { from: "rules", to: "output" },
          ],
          nodes: [
            { id: "input", label: "Data", x: 0, y: 50 },
            { id: "rules", label: "Rules", x: 100, y: 0 },
            { id: "output", label: "Output", x: 200, y: 50 },
          ],
        },
        visualKind: "diagram",
      },
    ],
  },
  {
    activityPosition: 2,
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          context: "Traditional programming requires explicit rules.",
          options: [
            {
              feedback: "Both use electricity. Think about problem-solving.",
              isCorrect: false,
              text: "Traditional uses electricity, ML uses batteries",
            },
            {
              feedback: "Exactly! ML discovers patterns from examples.",
              isCorrect: true,
              text: "ML learns patterns from data instead of explicit rules",
            },
            {
              feedback: "Speed isn't the key difference.",
              isCorrect: false,
              text: "Traditional programming is faster",
            },
          ],
          question:
            "What is the main difference between traditional programming and ML?",
        },
        kind: "multiple_choice",
      },
      {
        content: {
          pairs: [
            {
              left: "Supervised Learning",
              right: "Learning from labeled examples",
            },
            { left: "Unsupervised Learning", right: "Finding hidden patterns" },
            {
              left: "Reinforcement Learning",
              right: "Learning through trial and error",
            },
          ],
        },
        kind: "match_columns",
      },
      {
        content: {
          answers: ["supervised", "unsupervised"],
          feedback: "Great! You understand the difference.",
          template:
            "In {0} learning, the algorithm learns from labeled data, while in {1} learning, it finds patterns without labels.",
          wordBank: ["supervised", "unsupervised", "reinforcement", "deep"],
        },
        kind: "fill_blank",
      },
      {
        content: {
          items: [
            "Collect and prepare data",
            "Choose a model",
            "Train the model",
            "Evaluate performance",
            "Deploy to production",
          ],
          question: "Arrange the ML process in order:",
        },
        kind: "sort_order",
      },
    ],
  },
];

// Category data
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

export async function seedOrganization(
  prisma: PrismaClient,
  users: E2EUsers,
): Promise<Organization> {
  const org = await prisma.organization.upsert({
    create: {
      members: {
        create: [
          { role: "member", userId: users.withProgress.id },
          { role: "member", userId: users.noProgress.id },
          { role: "member", userId: users.logout.id },
        ],
      },
      name: "AI",
      slug: "ai",
    },
    update: {},
    where: { slug: "ai" },
  });

  return org;
}

export async function seedCourses(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  await Promise.all(
    coursesData.map((course) =>
      prisma.course.upsert({
        create: { organizationId: org.id, ...course },
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

async function seedChapterData(
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

  await Promise.all(
    data.chapters.map((chapterData, position) =>
      prisma.chapter.upsert({
        create: {
          courseId: course.id,
          description: chapterData.description,
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
          orgLanguageChapterSlug: {
            language: data.language,
            organizationId: org.id,
            slug: chapterData.slug,
          },
        },
      }),
    ),
  );
}

export async function seedChapters(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  await Promise.all(
    chaptersData.map((data) => seedChapterData(prisma, org, data)),
  );
}

async function seedLessonData(
  prisma: PrismaClient,
  org: Organization,
  data: ChapterLessons,
): Promise<void> {
  const chapter = await prisma.chapter.findFirst({
    where: {
      language: data.language,
      organizationId: org.id,
      slug: data.chapterSlug,
    },
  });

  if (!chapter) {
    return;
  }

  await Promise.all(
    data.lessons.map((lessonData, position) =>
      prisma.lesson.upsert({
        create: {
          chapterId: chapter.id,
          description: lessonData.description,
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
          orgLanguageLessonSlug: {
            language: data.language,
            organizationId: org.id,
            slug: lessonData.slug,
          },
        },
      }),
    ),
  );
}

export async function seedLessons(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  await Promise.all(
    lessonsData.map((data) => seedLessonData(prisma, org, data)),
  );
}

async function seedActivityData(
  prisma: PrismaClient,
  org: Organization,
  data: LessonActivities,
): Promise<void> {
  const lesson = await prisma.lesson.findFirst({
    where: {
      language: data.language,
      organizationId: org.id,
      slug: data.lessonSlug,
    },
  });

  if (!lesson) {
    return;
  }

  // Check if activities already exist for this lesson
  const existingActivities = await prisma.activity.count({
    where: { lessonId: lesson.id },
  });

  if (existingActivities > 0) {
    return;
  }

  await Promise.all(
    data.activities.map((activityData, position) =>
      prisma.activity.create({
        data: {
          description: activityData.description,
          inventory: activityData.inventory,
          isPublished: activityData.isPublished,
          kind: activityData.kind,
          language: data.language,
          lessonId: lesson.id,
          organizationId: org.id,
          position,
          title: activityData.title,
          winCriteria: activityData.winCriteria,
        },
      }),
    ),
  );
}

export async function seedActivities(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  await Promise.all(
    activitiesData.map((data) => seedActivityData(prisma, org, data)),
  );
}

async function seedStepData(
  prisma: PrismaClient,
  org: Organization,
  data: ActivitySteps,
): Promise<void> {
  const lesson = await prisma.lesson.findFirst({
    where: {
      language: data.language,
      organizationId: org.id,
      slug: data.lessonSlug,
    },
  });

  if (!lesson) {
    return;
  }

  const activity = await prisma.activity.findFirst({
    where: { lessonId: lesson.id, position: data.activityPosition },
  });

  if (!activity) {
    return;
  }

  // Check if steps already exist for this activity
  const existingSteps = await prisma.step.count({
    where: { activityId: activity.id },
  });

  if (existingSteps > 0) {
    return;
  }

  await Promise.all(
    data.steps.map((stepData, position) =>
      prisma.step.create({
        data: {
          activityId: activity.id,
          content: stepData.content,
          kind: stepData.kind,
          position,
          visualContent: stepData.visualContent,
          visualKind: stepData.visualKind,
        },
      }),
    ),
  );
}

export async function seedSteps(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  await Promise.all(stepsData.map((data) => seedStepData(prisma, org, data)));
}

export async function seedCategories(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  const courses = await prisma.course.findMany({
    select: { id: true, language: true, slug: true },
    where: { organizationId: org.id },
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
