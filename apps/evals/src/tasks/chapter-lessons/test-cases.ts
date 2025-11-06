const SHARED_EXPECTATIONS = `
  - Each lesson should cover a SINGLE, SPECIFIC concept that can be explained within 10 short tweets
  - Break down topics into the smallest, most manageable units possible, so that each lesson can be learned in 2-3 minutes
  - If a topic is too broad, split it into multiple lessons
  - Each lesson should be extremely focused on a SINGLE concept
  - If a lesson is too broad, split it into multiple lessons
  - If you find yourself using "AND", "OR", or "VS" in a title, you should split it into separate lessons
  - Lesson titles should be short and specific to the exact concept covered
  - Build a logical progression from basic to advanced concepts
  - Ensure lessons build on knowledge from previous lessons
  - Focus lessons for this specific chapter, not the entire course
  - Don't include summary or review lessons. For example, do NOT create a lesson title "Summary of Key Concepts" or "Review of Chapter"
  - Don't include assessment or quiz lessons
  - Don't include final project or capstone lessons
  - Should follow the language specified by locale parameter
  - Should follow title and description guidelines: no fluff, be concise, straight to the point
  - Descriptions should be concise and straight to the point, no fluff/filler words (avoid "learn", "understand", "explore", "introduction to", etc.)
  - You don't need to evaluate the output format here, just focus on the lesson content quality
  
  Things to check:
  - Is each lesson too broad? If so, it should be broken down further
  - Can each concept be explained in 10 short tweets or less? If not, it should be broken down
  - Does each lesson focus on a single specific concept? If not, it should be split
  - Does it have lessons that don't belong in this chapter? If so, they should be removed
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST be in US English
      - Should break down each HTML element type into separate lessons
      - Should cover attributes, forms, multimedia, and accessibility as distinct concepts
      - Should not group multiple element types together (e.g., not "Lists and Tables" but separate lessons)
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-html",
    userInput: {
      chapterDescription:
        "Structure and semantics of web content using HTML: Elements, attributes, forms, multimedia, and accessibility.",
      chapterTitle: "HTML",
      courseTitle: "Web Development",
      locale: "en",
    },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should break down each type of chemical bond into separate lessons
      - Should cover VSEPR, hybridization, and polarity as individual topics
      - Should not combine theoretical models in single lessons
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "es-chemistry-bonds",
    userInput: {
      chapterDescription:
        "Iónico, covalente y metálico; VSEPR, enlace de valencia, orbitales moleculares, hibridación y polaridad.",
      chapterTitle: "Enlace químico y estructura molecular",
      courseTitle: "Química",
      locale: "es",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - This is a complex theoretical topic that needs careful breakdown
      - Each econometric concept should be its own lesson
      - Should separate theory from practical application
      - Should break down assumptions individually
      - Should not cover topics that belong to Econometric Theory II: Asymptotics: Fixed and random effects, clustered errors, dynamic panels, and difference-in-differences foundations
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-econometrics",
    userInput: {
      chapterDescription:
        "OLS geometry, assumptions, identification, Gauss–Markov, hypothesis testing, and model diagnostics.",
      chapterTitle: "Econometric Theory I: Linear Models",
      courseTitle: "Economics",
      locale: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - This is a methodology chapter, should break down each Scrum element individually
      - Should cover roles, events, and artifacts as separate lessons
      - Should address anti-patterns as individual cautionary lessons
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-scrum",
    userInput: {
      chapterDescription:
        "Papéis, eventos e artefatos; Definition of Done/Ready, refinamento eficaz e anti‑padrões comuns.",
      chapterTitle: "Scrum na Prática",
      courseTitle: "Metodologias Ágeis",
      locale: "pt",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Language learning chapter - should break down each grammar structure separately
      - Should cover each tense/mood individually
      - Should not combine multiple grammatical concepts
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-subjunctive",
    userInput: {
      chapterDescription:
        "Influence, doubt, emotion, denial, volition, and impersonal expressions with triggers.",
      chapterTitle: "Subjunctive: Noun Clauses",
      courseTitle: "Spanish",
      locale: "en",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Legal topic requiring careful breakdown of each legal concept
      - Should cover Brazilian-specific law separately from general principles
      - Should break down constitutional vs civil vs criminal law topics individually
      - This chapter has a broad scope that needs many granular lessons
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-law-constitutional",
    userInput: {
      chapterDescription:
        "Fundamental principles, fundamental rights and guarantees, State organization, Union powers, constitutionality control.",
      chapterTitle: "Constitutional Law",
      courseTitle: "Brazilian Law",
      locale: "en",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Creative/pop culture topic that still needs structured breakdown
      - Should cover each spell category separately
      - Should break down wand lore, magical creatures, and history as individual lessons
      - Even though this is pop culture, lessons should still be focused and granular
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-harry-potter-magic-system",
    userInput: {
      chapterDescription:
        "Types of magic, wand lore, spell categories, nonverbal magic, wandless magic, and the limits of magic.",
      chapterTitle: "The Magic System",
      courseTitle: "Harry Potter",
      locale: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-mapeando-uma-trajetoria-de-carreira",
    userInput: {
      chapterDescription:
        "Competências nucleares, portfólio de projetos e branding profissional. Estratégias de estágio, bolsas e entrevistas.",
      chapterTitle: "Mapeando uma trajetória de carreira",
      courseTitle: "Neurociência",
      locale: "pt",
    },
  },
  {
    expectations: `
      - MUST be in US English
      
      ${SHARED_EXPECTATIONS}
    `,
    id: "en-portfolio-personal-branding",
    userInput: {
      chapterDescription:
        "Project selection, case studies, technical writing, talks, and community presence.",
      chapterTitle: "Portfolio & personal branding",
      courseTitle: "Web Development",
      locale: "en",
    },
  },
];
