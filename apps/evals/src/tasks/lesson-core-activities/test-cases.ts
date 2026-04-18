const SHARED_EXPECTATIONS = `
  EVALUATION CRITERIA:

  PRIORITY ORDER:
  - The most important checks are COMPLETE COVERAGE, NO REDUNDANCY, and PRACTICAL TITLE STYLE
  - If the plan misses important concepts, repeats the same teaching move twice, or uses dry academic titles, that is a MAJOR ERROR
  - Everything else is secondary and should usually be treated as minor or stylistic unless it is severe

  1. COMPLETE COVERAGE (MAJOR):
     - The full set of activities must cover the lesson's scope
     - Important concepts from the lesson must be represented somewhere in the plan
     - If a concept is missing entirely, that is a major error even if the titles sound good

  2. NO REDUNDANCY (MAJOR):
     - Activities should complement each other instead of repeating the same move
     - If two activities are duplicated, overlapping, or differ only by wording, that is a major error

  3. PRACTICAL TITLE STYLE (MAJOR):
     - Titles must feel learner-facing, concrete, and useful
     - Dry textbook or glossary-style titles are a major error
     - Penalize titles that just restate raw concept labels
     - Penalize generic filler such as "Introduction", "Review", "Summary", or "Key Concepts"

  4. COHERENT GROUPING:
     - Activities should group concepts into meaningful explanation chunks
     - Penalize one-title-per-concept breakdowns when concepts naturally belong together
     - Penalize disconnected titles that do not feel like part of one lesson flow

  5. RIGHT NUMBER OF ACTIVITIES:
     - Must return 1-5 explanation activities
     - The count should match lesson complexity
     - Do not create extra activities just to hit a higher number

  6. GOAL QUALITY:
     - Each activity must include a short, clear, one-sentence goal
     - Penalize vague goals like "understand the concept better"
     - Penalize broad, untestable goals that cover the whole lesson instead of that activity

  7. OUTPUT SHAPE:
     - Each activity should include only title and goal
     - Do not reward filler metadata or extra fields
`;

export const TEST_CASES = [
  {
    expectations: `
      Titles must be in US English.
      This lesson should likely land around 1-3 explanation activities.
      Avoid raw academic titles like "Function Declaration", "Function Call", or "Return Statement" as standalone activity titles.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript-turning-repeated-code",
    userInput: {
      chapterTitle: "Functions, Arrays, and Objects",
      concepts: [
        "Function Declaration",
        "Function Call",
        "Function Body",
        "Function Name",
        "Return Statement",
      ],
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Break a repeated task into a named block of code and run it when needed. These ideas make code shorter, easier to read, and easier to change later.",
      lessonTitle: "Turning repeated code into a function",
    },
  },
  {
    expectations: `
      Titles must be in US English.
      This lesson should likely land around 2-4 explanation activities.
      Avoid flattening the plan into separate glossary-style titles for "War Captivity", "Revenge Warfare", or "War Leadership".

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-warfare",
    userInput: {
      chapterTitle: "Indigenous Brazil Before Colonization",
      concepts: ["War Captivity", "Revenge Warfare", "Raiding Practices", "War Leadership"],
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Examine conflict on its own terms instead of through colonial stereotypes. Warfare often followed rules tied to honor, memory, alliance, and the taking of captives.",
      lessonTitle: "Understanding warfare beyond colonial stereotypes",
    },
  },
  {
    expectations: `
      Titles must be in Brazilian Portuguese.
      This lesson should likely land around 3-5 explanation activities.
      Avoid dry law-school headings like "Princípios Processuais", "Contraditório", or "Ampla Defesa" as standalone activity titles.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-regras-do-jogo",
    userInput: {
      chapterTitle: "Processo Civil",
      concepts: [
        "Inércia da Jurisdição",
        "Ação de Ofício",
        "Devido Processo Legal",
        "Contraditório",
        "Ampla Defesa",
        "Isonomia Processual",
      ],
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Entenda as regras básicas que dão forma ao processo civil e limitam o poder do juiz e das partes. Esse bloco ajuda a ler qualquer procedimento sem se perder no caminho.",
      lessonTitle: "Lendo o processo pelas regras do jogo",
    },
  },
  {
    expectations: `
      Titles must be in Latin American Spanish.
      This lesson should likely land around 3-5 explanation activities.
      Avoid turning each concept label into its own title such as "Biosignatura" or "Oxígeno atmosférico".

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-exoplanetas-vida-sin-exagerar",
    userInput: {
      chapterTitle: "Exoplanetas",
      concepts: [
        "Biosignatura",
        "Oxígeno atmosférico",
        "Ozono atmosférico",
        "Desequilibrio químico",
        "Biofirma espectral",
        "Falso positivo biológico",
      ],
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Aclara qué señal podría sugerir vida y por qué ninguna se interpreta sola. La clave está en leer el contexto completo antes de hacer afirmaciones grandes.",
      lessonTitle: "Buscando señales de vida sin exagerar",
    },
  },
  {
    expectations: `
      Titles must be in US English.
      This lesson should likely land around 3-5 explanation activities.
      Avoid one title per optimizer trick such as "AdamW", "Label Smoothing", or "Gradient Clipping".

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-transformers-training-stability",
    userInput: {
      chapterTitle: "Transformers",
      concepts: [
        "Dropout in Attention",
        "Label Smoothing",
        "Learning Rate Warmup",
        "AdamW",
        "Gradient Clipping",
      ],
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Training transformers well depends on a handful of optimization choices that became standard for a reason. These pieces help large models learn stably instead of blowing up or stalling.",
      lessonTitle: "Training transformers without instability",
    },
  },
];
