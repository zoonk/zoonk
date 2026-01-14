import type {
  ActivityKind,
  GenerationStatus,
  Organization,
  PrismaClient,
} from "../../generated/prisma/client";

type ActivitySeedData = {
  generationStatus: GenerationStatus;
  isPublished: boolean;
  kind: ActivityKind;
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
      {
        generationStatus: "completed",
        isPublished: true,
        kind: "background",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
      },
      {
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "examples",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "story",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "quiz",
      },
      {
        generationStatus: "completed",
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
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "quiz",
      },
    ],
    language: "en",
    lessonSlug: "what-is-machine-learning",
  },
  {
    activities: [
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "background",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
      },
      {
        generationStatus: "pending",
        isPublished: false,
        kind: "mechanics",
      },
    ],
    language: "en",
    lessonSlug: "history-of-ml",
  },
  {
    activities: [
      {
        description:
          "A custom activity exploring the differences between supervised and unsupervised learning approaches.",
        generationStatus: "pending",
        isPublished: false,
        kind: "custom",
        title: "Supervised vs Unsupervised Learning",
      },
    ],
    language: "en",
    lessonSlug: "types-of-learning",
  },
  {
    activities: [
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "background",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
      },
    ],
    language: "en",
    lessonSlug: "spanish-alphabet",
  },
  {
    activities: [
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "background",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
      },
    ],
    language: "en",
    lessonSlug: "the-sun",
  },
  {
    activities: [
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "background",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
      },
    ],
    language: "en",
    lessonSlug: "getting-started-python",
  },
  {
    activities: [
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "background",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
      },
    ],
    language: "en",
    lessonSlug: "intro-to-html",
  },
  {
    activities: [
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "background",
      },
      {
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
      },
    ],
    language: "en",
    lessonSlug: "what-is-data-science",
  },
];

export async function seedActivities(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  const allActivityPromises = activitiesData.flatMap((data) =>
    prisma.lesson
      .findFirst({
        where: {
          language: data.language,
          organizationId: org.id,
          slug: data.lessonSlug,
        },
      })
      .then(async (lesson) => {
        if (!lesson) {
          return;
        }

        await Promise.all(
          data.activities.map((activityData, position) =>
            prisma.activity.upsert({
              create: {
                description: activityData.description,
                generationStatus: activityData.generationStatus,
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
              update: {},
              where: {
                id: -1, // Force create since there's no unique constraint
              },
            }),
          ),
        );
      }),
  );

  await Promise.all(allActivityPromises);
}
