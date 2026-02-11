import {
  type Organization,
  type Prisma,
  type PrismaClient,
  type StepKind,
  type StepVisualKind,
} from "../../generated/prisma/client";

const stepsData: {
  lessonSlug: string;
  language: string;
  activityPosition: number;
  steps: {
    kind: StepKind;
    content: Prisma.InputJsonValue;
    visualKind?: StepVisualKind;
    visualContent?: Prisma.InputJsonValue;
  }[];
}[] = [
  {
    activityPosition: 0, // Background activity
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          text: "In 1956, a group of scientists gathered at Dartmouth College with an ambitious goal: create machines that could think like humans.",
          title: "The Birth of AI",
          variant: "text",
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
              description: "Neural networks achieve breakthrough in image recognition.",
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
          variant: "text",
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
          variant: "text",
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
    activityPosition: 2, // Explanation_quiz activity
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
              isCorrect: true,
              prompt: "A clear diagram of a neural network with connected layers of nodes",
              url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
            },
            {
              feedback: "This is a flowchart, not a neural network architecture.",
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
  {
    activityPosition: 6, // Challenge activity
    language: "en",
    lessonSlug: "what-is-machine-learning",
    steps: [
      {
        content: {
          text: "You're leading a machine learning project at a startup. Your goal is to build a successful model while managing resources and team morale. Make strategic decisions to win!",
          title: "",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          context:
            "Your team is building an ML model and discovers the training data has quality issues.",
          kind: "challenge",
          options: [
            {
              consequence: "Garbage in, garbage out. Poor data quality leads to poor models.",
              effects: [
                { dimension: "Data Quality", impact: "negative" },
                { dimension: "Model Accuracy", impact: "negative" },
                { dimension: "Team Morale", impact: "negative" },
              ],
              text: "Ignore it and proceed with training",
            },
            {
              consequence: "Good choice! Clean data is the foundation of good ML models.",
              effects: [
                { dimension: "Data Quality", impact: "positive" },
                { dimension: "Model Accuracy", impact: "positive" },
                { dimension: "Compute Resources", impact: "negative" },
              ],
              text: "Spend time cleaning and validating the data",
            },
            {
              consequence: "This wastes resources when cleaning could suffice.",
              effects: [
                { dimension: "Data Quality", impact: "positive" },
                { dimension: "Compute Resources", impact: "negative" },
                { dimension: "Team Morale", impact: "negative" },
              ],
              text: "Collect entirely new data from scratch",
            },
          ],
          question: "Your team discovers the training data has quality issues. What do you do?",
        },
        kind: "multipleChoice",
      },
      {
        content: {
          context:
            "The model is underperforming and a team member suggests using a more complex architecture.",
          kind: "challenge",
          options: [
            {
              consequence: "Complex models need more compute and may overfit. Start simple!",
              effects: [
                { dimension: "Compute Resources", impact: "negative" },
                { dimension: "Model Accuracy", impact: "positive" },
                { dimension: "Team Morale", impact: "positive" },
              ],
              text: "Immediately switch to the complex model",
            },
            {
              consequence: "Smart! Understanding the problem helps choose the right solution.",
              effects: [
                { dimension: "Data Quality", impact: "positive" },
                { dimension: "Model Accuracy", impact: "positive" },
                { dimension: "Team Morale", impact: "positive" },
              ],
              text: "First analyze why the current model is failing",
            },
            {
              consequence: "Ignoring team input hurts morale and misses opportunities.",
              effects: [{ dimension: "Team Morale", impact: "negative" }],
              text: "Dismiss the suggestion without discussion",
            },
          ],
          question:
            "The model is underperforming. A team member suggests using a more complex architecture. What's your decision?",
        },
        kind: "multipleChoice",
      },
      {
        content: {
          text: "Every ML project involves trade-offs between speed, quality, and team wellbeing. The best approach depends on your priorities and constraints.",
          title: "",
          variant: "text",
        },
        kind: "static",
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
