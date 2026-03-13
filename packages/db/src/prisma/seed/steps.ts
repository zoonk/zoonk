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
          text: "In 1956, a group of scientists gathered at Dartmouth College with an ambitious goal: create machines that could think like humans.",
          title: "The Birth of AI",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
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
          kind: "timeline",
        },
        kind: "visual",
      },
      {
        content: {
          text: "Traditional programming required explicit rules for every scenario. But what if computers could learn patterns from data instead?",
          title: "The Problem",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          edges: [
            { from: "input", to: "output" },
            { from: "rules", to: "output" },
          ],
          kind: "diagram",
          nodes: [
            { id: "input", label: "Data", x: 0, y: 50 },
            { id: "rules", label: "Rules", x: 100, y: 0 },
            { id: "output", label: "Output", x: 200, y: 50 },
          ],
        },
        kind: "visual",
      },
      {
        content: {
          text: "Machine learning flips the script: instead of programming rules, we provide examples and let the computer discover the patterns.",
          title: "A New Approach",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          author: "Tom Mitchell, 1997",
          kind: "quote",
          text: "A computer program is said to learn from experience E with respect to some task T and some performance measure P, if its performance on T, as measured by P, improves with experience E.",
        },
        kind: "visual",
      },
      {
        content: {
          text: "Each type of machine learning has distinct characteristics, strengths, and typical applications.",
          title: "Comparing ML Types",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          caption: "Key differences between the three main types of machine learning",
          columns: ["Type", "Data", "Goal", "Example"],
          kind: "table",
          rows: [
            ["Supervised", "Labeled", "Predict outcomes", "Spam detection"],
            ["Unsupervised", "Unlabeled", "Find patterns", "Customer grouping"],
            ["Reinforcement", "Rewards", "Maximize score", "Game playing"],
          ],
        },
        kind: "visual",
      },
      {
        content: {
          text: "Different types of ML require different amounts of labeled data to achieve good performance.",
          title: "Data Requirements",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          chartType: "bar",
          data: [
            { name: "Supervised", value: 85 },
            { name: "Semi-supervised", value: 40 },
            { name: "Unsupervised", value: 5 },
            { name: "Reinforcement", value: 15 },
          ],
          kind: "chart",
          title: "Labeled Data Required (%)",
        },
        kind: "visual",
      },

      // --- Code visual ---
      {
        content: {
          text: "A simple neural network can be built in just a few lines of Python using popular ML libraries.",
          title: "Building a Neural Network",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          annotations: [
            { line: 1, text: "Import the core library" },
            {
              line: 5,
              text: "Define three layers: input (784 pixels), hidden (128 neurons), output (10 classes)",
            },
            {
              line: 12,
              text: "Adam optimizer adjusts weights to minimize the loss function during training",
            },
          ],
          code: "import tensorflow as tf\n\n# Build a simple feedforward neural network for image classification\nmodel = tf.keras.Sequential([\n    tf.keras.layers.Dense(128, activation='relu', input_shape=(784,)),\n    tf.keras.layers.Dropout(0.2),\n    tf.keras.layers.Dense(64, activation='relu'),\n    tf.keras.layers.Dense(10, activation='softmax')\n])\n\n# Compile with optimizer, loss function, and metrics\nmodel.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])\n\n# Train the model on the dataset\nhistory = model.fit(train_images, train_labels, epochs=10, validation_split=0.2, batch_size=32)\n\n# Evaluate on test data\ntest_loss, test_accuracy = model.evaluate(test_images, test_labels, verbose=2)\nprint(f'Test accuracy: {test_accuracy:.4f}')",
          kind: "code",
          language: "python",
        },
        kind: "visual",
      },

      // --- Image visual ---
      {
        content: {
          text: "Neural networks are inspired by the structure of the human brain, with layers of interconnected nodes.",
          title: "Visual Representation",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          kind: "image",
          prompt:
            "A clean diagram showing a neural network with input layer, two hidden layers, and output layer, with nodes connected by weighted edges",
          url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
        },
        kind: "visual",
      },

      // --- Image visual without URL (fallback test) ---
      {
        content: {
          text: "Transfer learning allows models trained on large datasets to be adapted for specific tasks with minimal additional training.",
          title: "Transfer Learning",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          kind: "image",
          prompt:
            "A diagram showing a pre-trained model being fine-tuned for a specific classification task with a small dataset",
        },
        kind: "visual",
      },

      // --- Line chart ---
      {
        content: {
          text: "Model accuracy typically improves with more training data, but with diminishing returns after a certain point.",
          title: "Training Data vs. Accuracy",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          chartType: "line",
          data: [
            { name: "100", value: 45 },
            { name: "500", value: 62 },
            { name: "1K", value: 74 },
            { name: "5K", value: 85 },
            { name: "10K", value: 89 },
            { name: "50K", value: 93 },
            { name: "100K", value: 95 },
            { name: "500K", value: 96 },
          ],
          kind: "chart",
          title: "Model Accuracy by Training Samples",
        },
        kind: "visual",
      },

      // --- Pie chart ---
      {
        content: {
          text: "The global AI market is distributed across several key sectors, each with different adoption rates.",
          title: "AI Market Distribution",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          chartType: "pie",
          data: [
            { name: "Healthcare", value: 28 },
            { name: "Finance", value: 22 },
            { name: "Retail", value: 18 },
            { name: "Manufacturing", value: 15 },
            { name: "Transportation", value: 10 },
            { name: "Other", value: 7 },
          ],
          kind: "chart",
          title: "AI Adoption by Industry (%)",
        },
        kind: "visual",
      },

      // --- Large diagram (8 nodes, many edges) ---
      {
        content: {
          text: "A complete ML pipeline involves multiple interconnected stages, from data collection to deployment and monitoring.",
          title: "ML Pipeline Architecture",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          edges: [
            { label: "collects", source: "collect", target: "clean" },
            { label: "prepares", source: "clean", target: "features" },
            { source: "features", target: "split" },
            { label: "trains on", source: "split", target: "train" },
            { label: "validates", source: "split", target: "validate" },
            { label: "optimizes", source: "validate", target: "tune" },
            { source: "tune", target: "train" },
            { label: "deploys", source: "train", target: "deploy" },
            { label: "monitors", source: "deploy", target: "monitor" },
            { label: "retrains", source: "monitor", target: "collect" },
          ],
          kind: "diagram",
          nodes: [
            { id: "collect", label: "Data Collection" },
            { id: "clean", label: "Data Cleaning" },
            { id: "features", label: "Feature Engineering" },
            { id: "split", label: "Train/Test Split" },
            { id: "train", label: "Model Training" },
            { id: "validate", label: "Validation" },
            { id: "tune", label: "Hyperparameter Tuning" },
            { id: "deploy", label: "Deployment" },
            { id: "monitor", label: "Monitoring" },
          ],
        },
        kind: "visual",
      },

      // --- Wide table (6 columns, 5 rows) ---
      {
        content: {
          text: "Different ML algorithms have distinct trade-offs in terms of complexity, interpretability, and performance characteristics.",
          title: "Algorithm Comparison",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          caption: "Comparison of popular machine learning algorithms across key dimensions",
          columns: [
            "Algorithm",
            "Type",
            "Complexity",
            "Interpretability",
            "Training Speed",
            "Best For",
          ],
          kind: "table",
          rows: [
            [
              "Linear Regression",
              "Supervised",
              "Low",
              "High",
              "Very Fast",
              "Continuous prediction",
            ],
            [
              "Decision Tree",
              "Supervised",
              "Medium",
              "High",
              "Fast",
              "Classification & regression",
            ],
            ["Random Forest", "Ensemble", "High", "Medium", "Medium", "Complex classification"],
            [
              "Neural Network",
              "Deep Learning",
              "Very High",
              "Low",
              "Slow",
              "Image & text processing",
            ],
            ["K-Means", "Unsupervised", "Low", "Medium", "Fast", "Customer segmentation"],
          ],
        },
        kind: "visual",
      },

      // --- Long timeline (7 events) ---
      {
        content: {
          text: "The evolution of deep learning has been marked by key breakthroughs spanning several decades.",
          title: "Deep Learning History",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          events: [
            {
              date: "1943",
              description:
                "Warren McCulloch and Walter Pitts propose a mathematical model of artificial neurons.",
              title: "First Neural Model",
            },
            {
              date: "1958",
              description:
                "Frank Rosenblatt builds the Perceptron, the first trainable neural network hardware.",
              title: "The Perceptron",
            },
            {
              date: "1986",
              description:
                "Rumelhart, Hinton, and Williams popularize backpropagation, enabling training of multi-layer networks.",
              title: "Backpropagation",
            },
            {
              date: "1997",
              description:
                "Hochreiter and Schmidhuber introduce Long Short-Term Memory networks for sequence data.",
              title: "LSTM Networks",
            },
            {
              date: "2012",
              description:
                "AlexNet wins ImageNet competition by a large margin, sparking the deep learning revolution.",
              title: "AlexNet & ImageNet",
            },
            {
              date: "2017",
              description:
                'Google publishes "Attention Is All You Need", introducing the Transformer architecture.',
              title: "Transformers",
            },
            {
              date: "2022",
              description:
                "Large language models like GPT and Claude demonstrate emergent reasoning capabilities at scale.",
              title: "LLM Era",
            },
          ],
          kind: "timeline",
        },
        kind: "visual",
      },

      // --- Code with long lines (horizontal scroll test) ---
      {
        content: {
          text: "Data preprocessing is a critical step that can make or break your model's performance.",
          title: "Data Preprocessing",
          variant: "text",
        },
        kind: "static",
      },
      {
        content: {
          annotations: [
            {
              line: 13,
              text: "StandardScaler normalizes features to have zero mean and unit variance, preventing features with large ranges from dominating",
            },
          ],
          code: "import pandas as pd\nfrom sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder\nfrom sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV, StratifiedKFold\n\n# Load and preprocess the dataset with proper handling of missing values, outliers, and categorical encoding\ndf = pd.read_csv('data/training_dataset_v3_cleaned_normalized_with_augmentation_final.csv', encoding='utf-8', parse_dates=['created_at', 'updated_at'])\n\n# Handle missing values with domain-specific imputation strategies for each column type\ndf['numerical_features'] = df['numerical_features'].fillna(df['numerical_features'].median())\ndf['categorical_features'] = df['categorical_features'].fillna(df['categorical_features'].mode()[0])\n\n# Apply feature scaling and transformation pipeline\nscaler = StandardScaler()\ndf[['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5']] = scaler.fit_transform(df[['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5']])\n\n# Split with stratification to maintain class distribution\nX_train, X_test, y_train, y_test = train_test_split(df.drop('target', axis=1), df['target'], test_size=0.2, random_state=42, stratify=df['target'])",
          kind: "code",
          language: "python",
        },
        kind: "visual",
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
  {
    activityPosition: 4, // Challenge activity
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
