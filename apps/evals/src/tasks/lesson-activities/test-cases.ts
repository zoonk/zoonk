const SHARED_EXPECTATIONS = `
  EVALUATION CRITERIA (focus on these, not specific phase names):

  1. ACTIVITY SIZING: Each activity must be substantial enough to expand into ~10 detailed steps. If an activity could only be explained in 1-3 steps, it's TOO SMALL.

  2. NO SINGLE ACTIONS: Activities must NOT be single actions like "boil water", "click button", "hold item". These are steps, not activities.

  3. LOGICAL GROUPING: Related actions should be grouped into meaningful phases rather than listed separately.

  4. COMPLETENESS: Activities should cover the full scope of the lesson - check if anything important is missing.

  5. APPROPRIATE SCOPE: Content should match the lesson's scope - not broader, not narrower.

  6. CLEAR TITLES: Titles must be short and action-oriented. No vague words like "learn about", "understand", "explore" in titles. Descriptions have more flexibility but should prefer action-oriented language.

  7. NO FLUFF: No summary, review, or assessment activities.

  IMPORTANT: Do NOT penalize for missing specific phases you might expect. Different valid approaches exist. Focus on whether the activities provided are well-sized and cover the lesson scope.
`;

export const TEST_CASES = [
  // Cooking/Recipe
  {
    expectations: `
      Avoid granular steps like "boil water" or "add salt" - these belong inside activities, not as activities themselves.

      Activity ordering matters for time-sensitive cooking steps. For carbonara, the guanciale should ideally be cooked before or while the pasta cooks so the pasta is hot for the final emulsification. Listing pasta fully before guanciale is a minor sequencing issue, not a fundamental error.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-cooking-pasta",
    userInput: {
      chapterTitle: "Italian Classics",
      courseTitle: "Home Cooking Basics",
      language: "en",
      lessonDescription: "Step-by-step guide to making authentic spaghetti carbonara from scratch",
      lessonTitle: "Making Spaghetti Carbonara",
    },
  },
  // DIY/Home Improvement
  {
    expectations: `
      Avoid granular steps like "open paint can" or "dip brush" - these belong inside activities, not as activities themselves.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-diy-paint-wall",
    userInput: {
      chapterTitle: "Interior Painting",
      courseTitle: "DIY Home Improvement",
      language: "en",
      lessonDescription:
        "How to properly paint an interior wall including preparation, priming, and applying paint",
      lessonTitle: "Painting a Wall",
    },
  },
  // Music/Instruments
  {
    expectations: `
      Avoid granular steps like "hold the pick" or "place finger on fret" - these belong inside activities, not as activities themselves.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-music-guitar-setup",
    userInput: {
      chapterTitle: "Getting Started",
      courseTitle: "Learn Guitar",
      language: "en",
      lessonDescription:
        "How to tune your guitar and hold it correctly for your first practice session",
      lessonTitle: "Setting Up Your Guitar",
    },
  },
  // Photography
  {
    expectations: `
      Avoid granular steps like "press shutter button" or "adjust ISO dial" - these belong inside activities, not as activities themselves.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-photo-portrait",
    userInput: {
      chapterTitle: "Portrait Photography",
      courseTitle: "Photography Fundamentals",
      language: "en",
      lessonDescription: "How to take a professional-looking portrait photo using natural light",
      lessonTitle: "Taking Portrait Photos",
    },
  },
  // Fitness/Exercise
  {
    expectations: `
      Avoid granular cues like "bend knees" or "keep back straight" - these belong inside activities as steps, not as activities themselves.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-fitness-squat",
    userInput: {
      chapterTitle: "Lower Body",
      courseTitle: "Strength Training Basics",
      language: "en",
      lessonDescription: "How to perform a proper barbell squat with correct form and technique",
      lessonTitle: "The Barbell Squat",
    },
  },
  // Gardening
  {
    expectations: `
      Titles and descriptions must be in Portuguese.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-gardening-tomatoes",
    userInput: {
      chapterTitle: "Horta em Casa",
      courseTitle: "Jardinagem para Iniciantes",
      language: "pt",
      lessonDescription:
        "Como plantar tomates em vasos, desde a preparação do solo até os primeiros cuidados",
      lessonTitle: "Plantando Tomates em Vasos",
    },
  },
  // Arts & Crafts
  {
    expectations: `
      Titles and descriptions must be in Spanish.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-craft-origami",
    userInput: {
      chapterTitle: "Figuras Básicas",
      courseTitle: "Origami para Principiantes",
      language: "es",
      lessonDescription:
        "Cómo hacer una grulla de papel paso a paso con técnicas básicas de origami",
      lessonTitle: "Haciendo una Grulla de Papel",
    },
  },
  // Business/Finance
  {
    expectations: `
      Avoid granular steps like "open Excel" or "type numbers" - these belong inside activities, not as activities themselves.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-finance-budget",
    userInput: {
      chapterTitle: "Personal Finance",
      courseTitle: "Money Management",
      language: "en",
      lessonDescription:
        "How to create a monthly budget using a spreadsheet to track income and expenses",
      lessonTitle: "Creating a Monthly Budget",
    },
  },
  // Science/Experiment
  {
    expectations: `
      Avoid granular steps like "pour vinegar" or "add baking soda" - these belong inside activities, not as activities themselves.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-science-volcano",
    userInput: {
      chapterTitle: "Chemistry at Home",
      courseTitle: "Fun Science Experiments",
      language: "en",
      lessonDescription: "How to build and activate a baking soda volcano for a science project",
      lessonTitle: "Making a Baking Soda Volcano",
    },
  },
  // Edge case - very simple task
  {
    expectations: `
      SPECIAL CONSIDERATION: This is an extremely simple task (cracking a single egg).

      The number of activities should reflect task complexity - a simple task needs fewer activities than a complex one. Over-fragmenting a simple task into many activities is a sign of poor sizing. For extremely simple tasks like this, 1-2 activities are acceptable even if individual activities cannot fully reach the 10-step threshold. The priority is avoiding over-fragmentation, not hitting a step count.

      Avoid granular steps like "hold egg", "tap egg", "position over bowl" - these are steps within an activity, not activities themselves.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-edge-simple-task",
    userInput: {
      chapterTitle: "Kitchen Basics",
      courseTitle: "Cooking 101",
      language: "en",
      lessonDescription: "How to properly crack an egg without getting shell in the bowl",
      lessonTitle: "Cracking an Egg",
    },
  },
  // Edge case - complex multi-step process
  {
    expectations: `
      SPECIAL CONSIDERATION: This is a complex, multi-phase process. The lesson description explicitly mentions multiple distinct phases.

      Each activity should represent a substantial phase. Complex tasks naturally require more activities than simple ones.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-edge-complex-process",
    userInput: {
      chapterTitle: "Bread Making",
      courseTitle: "Artisan Baking",
      language: "en",
      lessonDescription:
        "Complete guide to making sourdough bread from starter to finished loaf, including feeding the starter, mixing, folding, proofing, shaping, and baking",
      lessonTitle: "Making Sourdough Bread",
    },
  },
  // Software/Tech (keeping one for diversity)
  {
    expectations: `
      Avoid granular steps like "open browser", "click download", "click next" - these belong inside activities, not as activities themselves.

      Titles and descriptions must be in Portuguese.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-tech-git-setup",
    userInput: {
      chapterTitle: "Primeiros Passos",
      courseTitle: "Git e GitHub",
      language: "pt",
      lessonDescription: "Guia passo a passo para instalar e configurar o Git no seu computador",
      lessonTitle: "Configurando o Git",
    },
  },
];
