const SHARED_EXPECTATIONS = `
  EVALUATION CRITERIA (focus on storytelling quality, not specific content):

  1. STORYTELLING FLOW: The steps should build curiosity and follow a narrative arc. Check for tension (the problem/limitation) and resolution (how it was solved). IMPORTANT: "narrative arc" does NOT require a historical timeline. A conceptual narrative using metaphors and scenarios (e.g., "imagine your money shrinking") is equally valid as a historical narrative (e.g., "in ancient Rome..."). Both approaches can have tension and resolution.

  2. STEP SIZING: Each step must have a title (max 50 chars) and text (max 300 chars). Verify lengths are within limits.

  3. CONVERSATIONAL TONE: The writing should feel like talking to a curious friend, not reading an encyclopedia. Look for vivid imagery and emotional engagement.

  4. METAPHORS & ANALOGIES: Check that the writing uses analogies or vivid imagery to make abstract concepts tangible. The prompt suggests everyday life examples (sports, cooking, games, music, travel), but domain-appropriate metaphors are equally valid. For example, art-specific imagery for an art topic or historical scenes for a history topic are perfectly fine. Do NOT penalize for using metaphors outside the suggested categories.

  5. FOCUS ON "WHY": The activity explains the origin and importance of a topic — NOT how it works technically. If the output dives into detailed mechanics, implementation, or jargon, that's a problem. However, high-level conceptual descriptions through analogies (e.g., "like nesting dolls, each containing a smaller version") are acceptable — explaining WHAT a concept does at an intuitive level is often necessary to explain WHY it matters.

  6. APPROPRIATE SCOPE: Content should match the lesson's scope exactly — not broader (covering the whole field) and not narrower (covering only a sub-topic).

  7. VIVID SCENES: Each step should feel like a "scene" with imagery, not a bullet point of dry facts.

  IMPORTANT: Do NOT penalize for specific historical facts, dates, or phases you might expect. Different valid narrative approaches exist. Focus on whether the story provided is engaging and explains WHY this topic matters.

  IMPORTANT: Do NOT require a specific number of steps. Simple topics may need fewer steps; complex topics may need more. Judge quality, not quantity.

  IMPORTANT: Make sure the output is factually correct. It should not include any information that is not true.

  IMPORTANT: Do NOT penalize for JSON structure choices (e.g., returning { "steps": [...] } vs a bare array). Focus exclusively on the content quality of the steps themselves.

  IMPORTANT: A "Background" story can take many valid forms — historical narrative, conceptual metaphor journey, scenario-based explanation, or a mix. Do NOT require a specific approach. A well-crafted conceptual narrative with vivid metaphors and clear tension/resolution is just as valid as a historical origin story.
`;

export const TEST_CASES = [
  // Initial chapter (2/105), initial lesson (1/117) — foundational networking concept
  {
    expectations: `
      Avoid diving into packet header formats, protocol specifications, or byte-level details. The background should explain WHY data needs to be broken into packets and what problems this solved — not HOW packet headers are structured.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-packets",
    userInput: {
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "A packet as the unit of data routed across IP networks. What headers exist for delivery versus payload for the next layer.",
      lessonTitle: "Packets",
    },
  },
  // Initial chapter (2/105), mid lesson (60/117) — technical networking concept
  {
    expectations: `
      Avoid diving into congestion window algorithms, TCP slow start formulas, or implementation details. The background should explain WHY networks needed congestion control and what happens without it — not HOW TCP congestion algorithms work step by step.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-tcp-congestion-control",
    userInput: {
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "TCP congestion window as the sender's limit based on perceived network capacity. Why congestion control prevents persistent overload.",
      lessonTitle: "TCP congestion control",
    },
  },
  // Initial chapter (4/86), initial lesson (3/94) — Portuguese, programming concept
  {
    expectations: `
      Titles and descriptions must be in Portuguese.

      Avoid diving into isinstance() syntax, type hierarchy internals, or code examples. The background should explain WHY checking type membership matters and what problems arise without it — not HOW to call isinstance().

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-isinstance",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Teste de pertencimento a uma classe numérica, incluindo relações como bool ser subclasse de int.",
      lessonTitle: "isinstance() com tipos numéricos",
    },
  },
  // Mid chapter (47/92), initial lesson (1/179) — Spanish, chemistry concept
  {
    expectations: `
      Titles and descriptions must be in Spanish.

      Avoid diving into electron density diagrams, orbital descriptions, or reaction mechanisms. The background should explain WHY the uneven charge distribution in C=O bonds matters and what it enables in chemistry — not HOW to draw resonance structures.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-carbonilo-polarizacion",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "Distribución desigual de densidad electrónica entre C y O que vuelve al carbono susceptible a ataque nucleofílico.",
      lessonTitle: "Carbonilo: polarización C=O",
    },
  },
  // Mid chapter (35/104), mid lesson (52/101) — economics concept
  {
    expectations: `
      Avoid diving into econometric equations, regression analysis, or mathematical models. The background should explain WHY economists noticed a relationship between inflation and unemployment and what that insight meant for policy — not HOW to estimate or test the Phillips curve.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-phillips-curve",
    userInput: {
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "A negative empirical relationship between inflation and unemployment observed in some periods.",
      lessonTitle: "Phillips curve correlation",
    },
  },
  // Mid chapter (35/104), final lesson (101/101) — narrow economics concept
  {
    expectations: `
      SPECIAL CONSIDERATION: This is a narrow, technical topic. The background should still have a narrative, but it may be shorter since the scope is focused.

      Avoid diving into index construction formulas or statistical methodology. The background should explain WHY economists needed a way to summarize whether the economy is broadly expanding or contracting — not HOW to compute a diffusion index.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-diffusion-index",
    userInput: {
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "A composite index summarizing the share of sectors expanding versus contracting at a point in time.",
      lessonTitle: "Diffusion index",
    },
  },
  // Mid chapter (33/64), mid lesson (47/93) — Portuguese, agile/architecture concept
  {
    expectations: `
      Titles and descriptions must be in Portuguese.

      Avoid diving into implementation patterns, code examples, or specific architectural frameworks. The background should explain WHY systems need a protective layer when integrating with external models — not HOW to implement an anti-corruption layer.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-camada-anticorrupcao",
    userInput: {
      chapterTitle: "Arquitetura em ambientes ágeis",
      courseTitle: "Metodologias Ágeis",
      language: "pt",
      lessonDescription:
        "Camada que traduz modelos e integrações para evitar que conceitos externos contaminem o núcleo. Útil quando integrações mudam com frequência.",
      lessonTitle: "Camada anticorrupção",
    },
  },
  // Mid chapter (31/91), mid lesson (44/87) — creative/fiction, philosophical concept
  {
    expectations: `
      This is a fictional/literary analysis topic. The background should explain the concept within the Harry Potter universe — WHY Horcruxes matter to the story and what they represent thematically. Avoid listing plot points mechanically; focus on the narrative significance and the moral weight of the concept.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-harry-potter-horcrux-definition",
    userInput: {
      chapterTitle: "Alchemy, Horcruxes, and immortality",
      courseTitle: "Harry Potter",
      language: "en",
      lessonDescription:
        "A Horcrux is a container that holds a severed soul fragment to prevent final death.",
      lessonTitle: "Horcrux definition",
    },
  },
  // Final chapter (59/63), mid lesson (46/90) — historical/science concept
  {
    expectations: `
      Avoid diving into DDT's chemical composition or detailed toxicology. The background should explain WHY DDT was seen as revolutionary for disease control and what tensions arose around its use — not HOW DDT kills insects at a molecular level.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-ddt",
    userInput: {
      chapterTitle: "Health and disease",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        'The use of DDT as a "miracle" tool and the later controversy over harms and dependency.',
      lessonTitle: "DDT in vector control",
    },
  },
  // Final chapter (59/63), final lesson (90/90) — recent topic, politically charged
  {
    expectations: `
      SPECIAL CONSIDERATION: This is a very recent topic (COVID-19 pandemic memory). The "history" is still unfolding. The background should explain WHY competing narratives about the pandemic emerged and what they reveal about Brazilian society — not a chronological retelling of the pandemic.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-covid-memory",
    userInput: {
      chapterTitle: "Health and disease",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Public mourning, memorials, and denialism as competing narratives that politicized pandemic memory.",
      lessonTitle: "COVID-19 memory politics",
    },
  },
  // Late chapter (73/108), mid lesson (57/115) — Portuguese, legal/tech concept
  {
    expectations: `
      Titles and descriptions must be in Portuguese.

      Avoid diving into debugging workflows, code inspection techniques, or specific tools. The background should explain WHY distinguishing between data errors and template errors matters in legal document automation — not HOW to run a diagnostic procedure.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-diagnostico-erro",
    userInput: {
      chapterTitle: "Legal tech e automação de documentos",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Separar erro de dados do erro de template. Um procedimento para decidir se corrige o formulário ou a regra de montagem.",
      lessonTitle: "Diagnóstico de erro",
    },
  },
  // Mid chapter (47/92), final lesson (179/179) — Spanish, very narrow chemistry concept
  {
    expectations: `
      Titles and descriptions must be in Spanish.

      SPECIAL CONSIDERATION: This is a very narrow, advanced topic (selectivity control in Michael reactions). The background should still have a narrative, but it may be shorter since the scope is focused.

      Avoid diving into orbital theory, HSAB calculations, or detailed reaction mechanisms. The background should explain WHY chemists needed to control where reactions happen on a molecule and what the 1,2 vs 1,4 selectivity challenge represents — not HOW to predict selectivity using frontier molecular orbital theory.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-selectividad-1-2-1-4",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "En Michael, cambiar nucleófilo de duro a suave desplaza la selectividad entre 1,2 y 1,4.",
      lessonTitle: "Selectividad: control 1,2-1,4",
    },
  },
];
