import type {
  Organization,
  Prisma,
  PrismaClient,
  StepVisualKind,
} from "../../generated/prisma/client";

type StepSeedData = {
  kind: string;
  content: Prisma.InputJsonValue;
  visualKind?: StepVisualKind;
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
    activityPosition: 0, // background activity
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          text: "In 1956, a group of scientists gathered at Dartmouth College with an ambitious goal: create machines that could think like humans.",
          title: "The Birth of AI",
        },
        kind: "static",
        visualContent: {
          events: [
            {
              date: "1956",
              description: "The term 'Artificial Intelligence' is coined.",
              title: "Dartmouth Conference",
            },
            {
              date: "1997",
              description: "IBM's computer defeats world chess champion.",
              title: "Deep Blue",
            },
            {
              date: "2012",
              description:
                "Neural networks achieve breakthrough in image recognition.",
              title: "Deep Learning Revolution",
            },
          ],
        },
        visualKind: "timeline",
      },
      {
        content: {
          text: "Traditional programming required explicit rules for every scenario. But what if computers could learn patterns from data instead?",
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
      {
        content: {
          text: "Machine learning flips the script: instead of programming rules, we provide examples and let the computer discover the patterns.",
          title: "A New Approach",
        },
        kind: "static",
        visualContent: {
          author: "Tom Mitchell, 1997",
          text: "A computer program is said to learn from experience E with respect to some task T and some performance measure P, if its performance on T, as measured by P, improves with experience E.",
        },
        visualKind: "quote",
      },
    ],
  },
  {
    activityPosition: 2, // explanation_quiz activity
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          context:
            "Traditional programming requires explicit rules for every scenario.",
          options: [
            {
              feedback:
                "Both use electricity. Think about how they solve problems.",
              isCorrect: false,
              text: "Traditional programming uses electricity, ML uses batteries",
            },
            {
              feedback:
                "Exactly! ML discovers patterns from examples rather than following pre-programmed rules.",
              isCorrect: true,
              text: "ML learns patterns from data instead of following explicit rules",
            },
            {
              feedback:
                "Speed isn't the key difference. Consider how each approach solves problems.",
              isCorrect: false,
              text: "Traditional programming is faster than ML",
            },
          ],
          question:
            "What is the main difference between traditional programming and machine learning?",
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
          feedback:
            "Great! You understand the difference between these learning types.",
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
            "Choose a model architecture",
            "Train the model",
            "Evaluate performance",
            "Deploy to production",
          ],
          question: "Arrange the ML development process in the correct order:",
        },
        kind: "sort_order",
      },
      {
        content: {
          images: [
            {
              alt: "Connected layers of nodes",
              feedback:
                "Correct! Neural networks have interconnected layers of nodes.",
              isCorrect: true,
              url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
            },
            {
              alt: "Simple flowchart",
              feedback:
                "This is a flowchart, not a neural network architecture.",
              isCorrect: false,
              url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
            },
          ],
          question: "Which diagram best represents a neural network?",
        },
        kind: "select_image",
      },
    ],
  },
  {
    activityPosition: 6, // challenge activity
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          text: "You're leading a machine learning project at a startup. Your goal is to build a successful model while managing resources and team morale. Make strategic decisions to win!",
          title: "The ML Project Challenge",
        },
        kind: "static",
      },
      {
        content: {
          options: [
            {
              effects: { dataQuality: -10, modelAccuracy: -15, teamMorale: -5 },
              feedback:
                "Garbage in, garbage out. Poor data quality leads to poor models.",
              isCorrect: false,
              text: "Ignore it and proceed with training",
            },
            {
              effects: {
                computeResources: -5,
                dataQuality: 20,
                modelAccuracy: 10,
              },
              feedback:
                "Good choice! Clean data is the foundation of good ML models.",
              isCorrect: true,
              text: "Spend time cleaning and validating the data",
            },
            {
              effects: {
                computeResources: -25,
                dataQuality: 15,
                teamMorale: -10,
              },
              feedback: "This wastes resources when cleaning could suffice.",
              isCorrect: false,
              text: "Collect entirely new data from scratch",
            },
          ],
          question:
            "Your team discovers the training data has quality issues. What do you do?",
        },
        kind: "multiple_choice",
      },
      {
        content: {
          options: [
            {
              effects: {
                computeResources: -20,
                modelAccuracy: 5,
                teamMorale: 5,
              },
              feedback:
                "Complex models need more compute and may overfit. Start simple!",
              isCorrect: false,
              text: "Immediately switch to the complex model",
            },
            {
              effects: { dataQuality: 5, modelAccuracy: 15, teamMorale: 10 },
              feedback:
                "Smart! Understanding the problem helps choose the right solution.",
              isCorrect: true,
              text: "First analyze why the current model is failing",
            },
            {
              effects: { teamMorale: -20 },
              feedback:
                "Ignoring team input hurts morale and misses opportunities.",
              isCorrect: false,
              text: "Dismiss the suggestion without discussion",
            },
          ],
          question:
            "The model is underperforming. A team member suggests using a more complex architecture. What's your decision?",
        },
        kind: "multiple_choice",
      },
    ],
  },
];

export async function seedSteps(
  prisma: PrismaClient,
  org: Organization,
): Promise<void> {
  const stepCreationPromises = stepsData.map(async (data) => {
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
      where: {
        lessonId: lesson.id,
        position: data.activityPosition,
      },
    });

    if (!activity) {
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
  });

  await Promise.all(stepCreationPromises);
}
