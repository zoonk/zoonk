import {
  type Organization,
  type Prisma,
  type PrismaClient,
  type StepKind,
} from "../../generated/prisma/client";

const stepsData: {
  lessonSlug: string;
  language: string;
  activityPosition: number;
  steps: {
    kind: StepKind;
    content: Prisma.InputJsonValue;
  }[];
}[] = [
  {
    activityPosition: 0,
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          image: {
            prompt:
              "A horizontal timeline showing the Dartmouth Conference in 1956, Deep Blue in 1997, and the deep learning revolution in 2012",
          },
          text: "In 1956, a group of scientists gathered at Dartmouth College with an ambitious goal: create machines that could think like humans.",
          title: "The Birth of AI",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          image: {
            prompt:
              "A simple diagram showing data and rules combining into an output in traditional programming",
          },
          text: "Traditional programming required explicit rules for every scenario. But what if computers could learn patterns from data instead?",
          title: "The Limits of Rules",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          image: {
            prompt:
              "An educational illustration showing examples feeding into a machine learning model that discovers patterns",
          },
          text: "Machine learning flips the script: instead of programming rules, we provide examples and let the computer discover the patterns.",
          title: "Learning From Examples",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          image: {
            prompt:
              "A clean comparison graphic showing supervised, unsupervised, and reinforcement learning with their data and goals",
          },
          text: "Supervised learning learns from labeled examples, unsupervised learning finds structure on its own, and reinforcement learning improves through feedback from actions.",
          title: "Three Common Styles",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          image: {
            prompt:
              "A clean diagram showing a neural network with input layer, two hidden layers, and output layer, with nodes connected by weighted edges",
            url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
          },
          text: "Many modern ML systems use neural networks: layers of connected units that gradually transform raw input into useful predictions.",
          title: "Neural Networks in Practice",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          image: {
            prompt:
              "A diagram showing a pre-trained model being fine-tuned for a specific classification task with a small dataset",
          },
          text: "Instead of starting from zero every time, teams often adapt an existing model to a new task. That shortcut is one reason ML is so practical today.",
          title: "Why It Matters Now",
          variant: "text",
        },
        kind: "static",
      },
    ],
  },
  {
    activityPosition: 1, // Quiz activity
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          context: "Traditional programming requires explicit rules for every scenario.",
          kind: "core",
          options: [
            {
              feedback: "Both use electricity. Think about how they solve problems.",
              id: "electricity",
              isCorrect: false,
              text: "Traditional programming uses electricity, ML uses batteries",
            },
            {
              feedback:
                "Exactly! ML discovers patterns from examples rather than following pre-programmed rules.",
              id: "patterns-from-data",
              isCorrect: true,
              text: "ML learns patterns from data instead of following explicit rules",
            },
            {
              feedback:
                "Speed isn't the key difference. Consider how each approach solves problems.",
              id: "programming-speed",
              isCorrect: false,
              text: "Traditional programming is faster than ML",
            },
          ],
          question:
            "What is the main difference between traditional programming and machine learning?",
        },
        kind: "multipleChoice",
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
          question: "Match each learning type to its description.",
        },
        kind: "matchColumns",
      },
      {
        content: {
          answers: ["supervised", "unsupervised"],
          feedback: "Great! You understand the difference between these learning types.",
          question: "Fill in the blanks with the correct learning types.",
          template:
            "In {0} learning, the algorithm learns from labeled data, while in {1} learning, it finds patterns without labels.",
        },
        kind: "fillBlank",
      },
      {
        content: {
          feedback: "This sequence follows the standard end-to-end ML development lifecycle.",
          items: [
            "Collect and prepare data",
            "Choose a model architecture",
            "Train the model",
            "Evaluate performance",
            "Deploy to production",
          ],
          question: "Arrange the ML development process in the correct order:",
        },
        kind: "sortOrder",
      },
      {
        content: {
          options: [
            {
              feedback: "Correct! Neural networks have interconnected layers of nodes.",
              id: "neural-network",
              isCorrect: true,
              prompt: "A clear diagram of a neural network with connected layers of nodes",
              url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
            },
            {
              feedback: "This is a flowchart, not a neural network architecture.",
              id: "flowchart",
              isCorrect: false,
              prompt: "A simple flowchart with boxes and arrows",
              url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
            },
          ],
          question: "Which diagram best represents a neural network?",
        },
        kind: "selectImage",
      },
    ],
  },
];

export async function seedSteps(prisma: PrismaClient, org: Organization): Promise<void> {
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

    const existingCount = await prisma.step.count({
      where: { activityId: activity.id },
    });

    if (existingCount > 0) {
      return;
    }

    await Promise.all(
      data.steps.map((stepData, position) =>
        prisma.step.create({
          data: {
            activityId: activity.id,
            content: stepData.content,
            isPublished: true,
            kind: stepData.kind,
            position,
          },
        }),
      ),
    );
  });

  await Promise.all(stepCreationPromises);
}
