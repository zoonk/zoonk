const SHARED_EXPECTATIONS = `
  EVALUATION CRITERIA (focus on storytelling quality, not specific content):

  1. STORYTELLING FLOW: The steps should build curiosity and follow a narrative arc. Check for tension (the problem/limitation) and resolution (how it was solved).

  2. STEP SIZING: Each step must have a title (max 50 chars) and text (max 300 chars). Verify lengths are within limits.

  3. CONVERSATIONAL TONE: The writing should feel like talking to a curious friend, not reading an encyclopedia. Look for vivid imagery and emotional engagement.

  4. METAPHORS & ANALOGIES: Check for analogies from everyday life (sports, cooking, games, music, travel) that make abstract concepts tangible.

  5. FOCUS ON "WHY": The activity explains the origin and importance of a topic — NOT how it works technically. If the output dives into mechanics or implementation, that's a problem.

  6. APPROPRIATE SCOPE: Content should match the lesson's scope exactly — not broader (covering the whole field) and not narrower (covering only a sub-topic).

  7. VIVID SCENES: Each step should feel like a "scene" with imagery, not a bullet point of dry facts.

  IMPORTANT: Do NOT penalize for specific historical facts, dates, or phases you might expect. Different valid narrative approaches exist. Focus on whether the story provided is engaging and explains WHY this topic matters.

  IMPORTANT: Do NOT require a specific number of steps. Simple topics may need fewer steps; complex topics may need more. Judge quality, not quantity.

  IMPORTANT: Make sure the output is factually correct. It should not include any information that is not true.
`;

export const TEST_CASES = [
  // Programming concept
  {
    expectations: `
      Avoid jumping into code syntax or technical implementation. The background should explain WHY object-oriented programming was invented and what problems it solved — not HOW to use classes.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-programming-oop",
    userInput: {
      chapterTitle: "Programming Paradigms",
      courseTitle: "Introduction to Programming",
      language: "en",
      lessonDescription:
        "Understanding the core principles of object-oriented programming and why it revolutionized software development",
      lessonTitle: "Object-Oriented Programming",
    },
  },
  // Math concept
  {
    expectations: `
      Avoid diving into formulas, derivatives, or mathematical notation. The background should explain WHY calculus was invented and what problems it solved — not HOW to calculate limits.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-math-calculus",
    userInput: {
      chapterTitle: "Foundations",
      courseTitle: "Calculus I",
      language: "en",
      lessonDescription:
        "The origins of calculus and why mathematicians needed a new way to describe change and motion",
      lessonTitle: "What is Calculus?",
    },
  },
  // Science concept
  {
    expectations: `
      Avoid diving into DNA mechanics or genetic terminology. The background should explain WHY the theory of evolution was developed and what questions it answered — not HOW natural selection works at a biological level.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-science-evolution",
    userInput: {
      chapterTitle: "Life Science",
      courseTitle: "Biology Fundamentals",
      language: "en",
      lessonDescription:
        "How Darwin's observations led to a revolutionary understanding of how species change over time",
      lessonTitle: "The Theory of Evolution",
    },
  },
  // Abstract/philosophical concept
  {
    expectations: `
      Avoid listing logical operators or truth tables. The background should explain WHY formal logic was developed and what human problems it addressed — not HOW to construct syllogisms.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-philosophy-logic",
    userInput: {
      chapterTitle: "Foundations of Reasoning",
      courseTitle: "Introduction to Philosophy",
      language: "en",
      lessonDescription:
        "The ancient quest to find reliable rules for correct thinking and argumentation",
      lessonTitle: "What is Logic?",
    },
  },
  // Portuguese - Economics
  {
    expectations: `
      Titles and descriptions must be in Portuguese.

      Avoid diving into supply/demand curves or economic formulas. The background should explain WHY inflation matters and what historical problems it caused — not HOW central banks control it.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-economics-inflation",
    userInput: {
      chapterTitle: "Conceitos Básicos",
      courseTitle: "Economia para Iniciantes",
      language: "pt",
      lessonDescription: "Entendendo por que os preços sobem e como isso afeta a vida das pessoas",
      lessonTitle: "O que é Inflação?",
    },
  },
  // Spanish - Physics
  {
    expectations: `
      Titles and descriptions must be in Spanish.

      Avoid diving into formulas or mathematical equations. The background should explain WHY gravity was such a mystery and what questions it answered — not HOW to calculate gravitational force.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-physics-gravity",
    userInput: {
      chapterTitle: "Mecánica Clásica",
      courseTitle: "Física para Principiantes",
      language: "es",
      lessonDescription:
        "La historia de cómo los humanos entendieron por qué las cosas caen y los planetas orbitan",
      lessonTitle: "La Gravedad",
    },
  },
  // Edge case - very recent topic
  {
    expectations: `
      SPECIAL CONSIDERATION: This is a very recent topic (large language models). The "history" is short but still has a narrative arc of problems, attempts, and breakthroughs.

      The story should still have tension (what was hard about AI before?) and resolution (what changed?) even if the timeline is compressed.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-edge-recent-topic",
    userInput: {
      chapterTitle: "Modern AI",
      courseTitle: "Introduction to Machine Learning",
      language: "en",
      lessonDescription:
        "How AI went from rigid rule-based systems to models that can understand and generate human language",
      lessonTitle: "Large Language Models",
    },
  },
  // Edge case - very abstract topic
  {
    expectations: `
      SPECIAL CONSIDERATION: This is a highly abstract mathematical concept. The background should make it relatable through metaphors and real-world problems it solved.

      Avoid technical definitions or abstract mathematical language. Focus on WHY mathematicians needed this concept and what problems it addressed.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-edge-abstract-topic",
    userInput: {
      chapterTitle: "Advanced Concepts",
      courseTitle: "Discrete Mathematics",
      language: "en",
      lessonDescription:
        "Understanding why mathematicians needed a rigorous way to study collections of objects",
      lessonTitle: "Set Theory",
    },
  },
  // Technical/Engineering concept
  {
    expectations: `
      Avoid diving into database schemas or SQL syntax. The background should explain WHY databases were invented and what problems early computer systems faced — not HOW to structure tables.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-engineering-databases",
    userInput: {
      chapterTitle: "Data Storage",
      courseTitle: "Computer Science Fundamentals",
      language: "en",
      lessonDescription:
        "The history of how computers learned to organize and retrieve vast amounts of information",
      lessonTitle: "Introduction to Databases",
    },
  },
  // Art/Creative concept
  {
    expectations: `
      Avoid jumping into color theory rules or artistic techniques. The background should explain WHY artists became obsessed with light and color — not HOW to mix pigments.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-art-impressionism",
    userInput: {
      chapterTitle: "Art Movements",
      courseTitle: "Art History",
      language: "en",
      lessonDescription:
        "How a group of rebellious painters changed the way we see and capture the world",
      lessonTitle: "Impressionism",
    },
  },
  // Social Science concept
  {
    expectations: `
      Titles and descriptions must be in Portuguese.

      Avoid diving into research methodologies or academic frameworks. The background should explain WHY humans started systematically studying society — not HOW sociologists conduct research.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-social-sociology",
    userInput: {
      chapterTitle: "Introdução",
      courseTitle: "Sociologia",
      language: "pt",
      lessonDescription:
        "Como surgiu a necessidade de estudar cientificamente a sociedade e as relações humanas",
      lessonTitle: "O que é Sociologia?",
    },
  },
  // Edge case - very simple/narrow topic
  {
    expectations: `
      SPECIAL CONSIDERATION: This is a narrow topic (recursion in programming). The background should still have a narrative, but it may be shorter since the scope is focused.

      Avoid explaining how to write recursive functions. Focus on WHY recursion was developed as a concept and what elegant problems it solved.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-edge-narrow-topic",
    userInput: {
      chapterTitle: "Functions",
      courseTitle: "Programming Fundamentals",
      language: "en",
      lessonDescription:
        "Understanding the elegant idea of functions that call themselves to solve complex problems",
      lessonTitle: "Recursion",
    },
  },
];
