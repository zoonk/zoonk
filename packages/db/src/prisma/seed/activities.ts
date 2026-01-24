import {
  type ActivityKind,
  type GenerationStatus,
  type Organization,
  type PrismaClient,
} from "../../generated/prisma/client";

const activitiesData: {
  lessonSlug: string;
  language: string;
  activities: {
    generationStatus: GenerationStatus;
    isPublished: boolean;
    kind: ActivityKind;
    title?: string;
    description?: string;
    content?: { intro?: string; reflection?: string };
  }[];
}[] = [
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
        content: {
          intro:
            "Welcome to TechCorp, {{NAME}}! You've just joined the ML team during a critical project phase. Your decisions will shape the outcome.",
          reflection:
            "Every ML project involves trade-offs between speed, quality, and team wellbeing. The best approach depends on your priorities and constraints.",
        },
        generationStatus: "completed",
        isPublished: true,
        kind: "challenge",
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

export async function seedActivities(prisma: PrismaClient, org: Organization): Promise<void> {
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
                content: activityData.content,
                description: activityData.description,
                generationStatus: activityData.generationStatus,
                isPublished: activityData.isPublished,
                kind: activityData.kind,
                language: data.language,
                lessonId: lesson.id,
                organizationId: org.id,
                position,
                title: activityData.title,
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
