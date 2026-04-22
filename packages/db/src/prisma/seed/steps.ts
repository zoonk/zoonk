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
          title: "The Problem",
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
          title: "A New Approach",
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
          text: "Each type of machine learning has distinct characteristics, strengths, and typical applications.",
          title: "Comparing ML Types",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          image: {
            prompt:
              "A bar chart comparing labeled data requirements across supervised, semi-supervised, unsupervised, and reinforcement learning",
          },
          text: "Different types of ML require different amounts of labeled data to achieve good performance.",
          title: "Data Requirements",
          variant: "text",
        },
        kind: "static",
      },

      // --- Code image ---
      {
        content: {
          image: {
            prompt:
              "A clean illustration of a simple neural network for image classification with input, hidden, and output layers",
          },
          text: "A simple neural network can be built in just a few lines of Python using popular ML libraries.",
          title: "Building a Neural Network",
          variant: "text",
        },
        kind: "static",
      },

      // --- Formula image ---
      {
        content: {
          image: {
            prompt:
              "An educational illustration of mean squared error as distances between predictions and actual values on a chart",
          },
          text: "The loss function measures how far the model's predictions are from the actual values. Mean Squared Error is one of the most common choices for regression tasks.",
          title: "Loss Function",
          variant: "text",
        },
        kind: "static",
      },

      // --- Image example ---
      {
        content: {
          image: {
            prompt:
              "A clean diagram showing a neural network with input layer, two hidden layers, and output layer, with nodes connected by weighted edges",
            url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
          },
          text: "Neural networks are inspired by the structure of the human brain, with layers of interconnected nodes.",
          title: "Visual Representation",
          variant: "text",
        },
        kind: "static",
      },

      // --- Image example without URL (fallback test) ---
      {
        content: {
          image: {
            prompt:
              "A diagram showing a pre-trained model being fine-tuned for a specific classification task with a small dataset",
          },
          text: "Transfer learning allows models trained on large datasets to be adapted for specific tasks with minimal additional training.",
          title: "Transfer Learning",
          variant: "text",
        },
        kind: "static",
      },

      // --- Line chart ---
      {
        content: {
          image: {
            prompt:
              "A line chart showing model accuracy rising as training sample size increases with diminishing returns",
          },
          text: "Model accuracy typically improves with more training data, but with diminishing returns after a certain point.",
          title: "Training Data vs. Accuracy",
          variant: "text",
        },
        kind: "static",
      },

      // --- Pie chart image ---
      {
        content: {
          image: {
            prompt:
              "A pie chart showing AI adoption across healthcare, finance, retail, manufacturing, transportation, and other sectors",
          },
          text: "The global AI market is distributed across several key sectors, each with different adoption rates.",
          title: "AI Market Distribution",
          variant: "text",
        },
        kind: "static",
      },

      // --- Large diagram image ---
      {
        content: {
          image: {
            prompt:
              "A diagram of a machine learning pipeline from data collection through deployment and monitoring",
          },
          text: "A complete ML pipeline involves multiple interconnected stages, from data collection to deployment and monitoring.",
          title: "ML Pipeline Architecture",
          variant: "text",
        },
        kind: "static",
      },

      // --- Wide table image ---
      {
        content: {
          image: {
            prompt:
              "A comparison chart of machine learning algorithms showing complexity, interpretability, training speed, and best use cases",
          },
          text: "Different ML algorithms have distinct trade-offs in terms of complexity, interpretability, and performance characteristics.",
          title: "Algorithm Comparison",
          variant: "text",
        },
        kind: "static",
      },

      // --- Long timeline image ---
      {
        content: {
          image: {
            prompt:
              "A timeline of major deep learning milestones from the first neural model through the LLM era",
          },
          text: "The evolution of deep learning has been marked by key breakthroughs spanning several decades.",
          title: "Deep Learning History",
          variant: "text",
        },
        kind: "static",
      },

      // --- Data preprocessing image ---
      {
        content: {
          image: {
            prompt:
              "An illustration of a data preprocessing pipeline with cleaning, scaling, encoding, and train-test split",
          },
          text: "Data preprocessing is a critical step that can make or break your model's performance.",
          title: "Data Preprocessing",
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
