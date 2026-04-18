const SHARED_EXPECTATIONS = `
  # How to evaluate

  You are evaluating a CURRICULUM, not a glossary. Think like a curriculum designer reviewing a colleague's work — use domain expertise and professional judgment, not mechanical rule-checking.

  **Only three things should meaningfully drive the score down. Everything else is minor.**

  # Major penalties

  ## 1. Dry, textbook lesson titles

  Titles must be **active and hands-on** — a learner action, a question, or a concrete outcome. Noun-phrase categories that read like a table of contents are a major failure even when the content underneath is correct.

  - Dry (major issue): "Types of levers", "Warfare and conflict", "Landmark model families", "Fundamentals of catalysts", "Modalidades de pedido"
  - Active (good): "Picking a lever for heavy loads", "Why communities went to war", "How BERT, GPT, and T5 differ", "Speeding up a reaction with a catalyst", "Escolhendo o tipo certo de pedido"

  Ask: would a learner pick this title feeling pulled in, or like they're pushing through a syllabus? A curriculum dominated by dry titles is a major penalty, not a style nit.

  ## 2. Factual errors

  Anything in a lesson title, description, or concept that is factually wrong, historically inaccurate, technically incorrect, or would mislead a learner. Use your domain expertise — if a practitioner would catch it as wrong, it is a major penalty.

  ## 3. Important missing topics

  The curriculum must cover:

  - **Canonical fundamentals** of the chapter's topic — the pillars a serious learner must know, whether or not the description lists them explicitly. If a junior practitioner would be embarrassed on day 1 because a pillar is missing, that is a major penalty.
  - **Modern practice** — the tools, idioms, and conventions actually in use today. If the topic has evolved meaningfully in the last 15–20 years and the curriculum teaches only the pre-change textbook version, that is a major penalty.
  - **Specific named entities** that populate the domain — people, missions, tools, models, compounds, works, peoples, landmark systems — must appear as concepts, not only abstract category labels. An exoplanets chapter that names no specific exoplanet or mission, or a catalysts chapter that names no specific catalyst, has this failure.

  # Minor notes

  Everything else is a minor note and should NOT dominate the score:

  - Lesson sizes (ideal is 3–6 concepts with natural variation)
  - Concept title wording: abstract bare terms, verbosity, thesis-style framing
  - Conjunctions (AND/OR/VS) inside concept titles — flag them, but minor
  - Description openers and style — "introduces / covers / explores", "You will..."
  - Progression polish, summary/review lessons, minor scope bleed into neighboring chapters

  Mention these in a single consolidated minor-issues note. A curriculum that nails active titles, accurate facts, and comprehensive coverage of fundamentals and modern practice is strong even with wording nits.

  # Scope and neighboring chapters

  Neighboring chapters are guardrails against scope creep, not vetoes. Judge by framing, not by keywords — a lesson belongs here if its primary teaching purpose serves this chapter's goals, even if it mentions words that appear in a neighbor's title.
`;

export const TEST_CASES = [
  // Initial chapter: beginner-level programming
  {
    expectations: `
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript-functions-arrays-objects",
    userInput: {
      chapterDescription:
        "Break code into reusable pieces, return results, and manage data with arrays and objects. You begin writing code that stays readable as it grows.",
      chapterTitle: "Functions, Arrays, and Objects",
      courseTitle: "JavaScript",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Start by making a tiny program that reacts to a click, changes text on the page, and keeps score. You touch real JavaScript right away: variables, functions, events, and the browser console.",
          title: "Make a Click Counter",
        },
        {
          description:
            "Write values, combine them, compare them, and control what happens next. This chapter builds the core habits behind almost every JavaScript program.",
          title: "Values, Conditions, and Repetition",
        },
        {
          description:
            "Use the DOM to read page content, change styles, create elements, and respond to user actions. This is the bridge from small scripts to real browser behavior.",
          title: "Changing a Web Page with JavaScript",
        },
        {
          description:
            "Handle forms, validate input, save data in the browser, and build interactions that feel complete to a user. The work here looks much closer to everyday front-end tasks.",
          title: "Forms, Validation, and Local Storage",
        },
      ],
    },
  },
  // Initial chapter: beginner-level humanities
  {
    expectations: `
      - MUST be in US English (proper nouns of Brazilian institutions and places remain in Portuguese)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-indigenous-before-colonization",
    userInput: {
      chapterDescription:
        "This chapter follows the many peoples already living in the land before 1500, including language families, trade networks, farming, warfare, and belief systems. It also shows how archaeologists, oral traditions, and colonial records help rebuild histories that were often erased.",
      chapterTitle: "Indigenous Brazil Before Colonization",
      courseTitle: "Brazilian History",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Start with a close look at the letter Pero Vaz de Caminha wrote in 1500 and other early accounts of first contact. The learner works with real words from the period to spot power, curiosity, religion, trade, and misunderstanding at the beginning of Brazil's written history.",
          title: "Reading the First Portuguese Accounts",
        },
        {
          description:
            "See how Portugal claimed, mapped, and tried to control the territory through captaincies, forts, missions, and coastal settlements. The chapter connects imperial policy with the hard realities of distance, labor, and resistance on the ground.",
          title: "Claiming and Settling the Colony",
        },
        {
          description:
            "Sugar mills, enslaved labor, Atlantic shipping, and merchant credit turned colonial Brazil into a major plantation zone. This chapter shows how the sugar economy worked day to day and how wealth and violence were built together.",
          title: "Sugar, Land, and the Atlantic System",
        },
        {
          description:
            "This chapter centers the forced migration of Africans, the slave trade, labor regimes, family formation, religion, revolt, and cultural survival. It treats slavery as a core structure of Brazilian history, not a side topic.",
          title: "Slavery and African Diaspora in Brazil",
        },
      ],
    },
  },
  // Mid-course chapter: mid-level domain depth
  {
    expectations: `
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-processo-civil",
    userInput: {
      chapterDescription:
        "Cobre princípios processuais, competência, partes, atos processuais, provas, tutelas, sentença e recursos no processo civil. É a espinha dorsal para transformar direitos em pedidos eficazes perante o Judiciário.",
      chapterTitle: "Processo Civil",
      courseTitle: "Direito",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Apresenta tributos, competências, limitações ao poder de tributar, obrigação tributária, lançamento, crédito e defesa do contribuinte. Conecta a teoria tributária à vida de pessoas, empresas e governo.",
          title: "Direito Tributário",
        },
        {
          description:
            "Trabalha vínculo de emprego, jornada, salário, férias, FGTS, rescisão, negociação coletiva e rotina das relações de trabalho. Mostra como prevenir passivos e lidar com conflitos trabalhistas.",
          title: "Direito do Trabalho",
        },
        {
          description:
            "Mostra inquérito, ação penal, crimes, penas, provas, garantias e recursos no processo penal. Dá base para atuar com acusação, defesa e controle da legalidade da persecução penal.",
          title: "Direito Penal e Processo Penal",
        },
        {
          description:
            "Apresenta proteção ao consumidor, oferta, publicidade, vício, defeito, responsabilidade do fornecedor e tutela coletiva. Mostra um dos campos mais presentes no dia a dia forense e consultivo.",
          title: "Direito do Consumidor",
        },
      ],
    },
  },
  // Late chapter: expert-level scientific depth
  {
    expectations: `
      - MUST be in Latin American Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-astronomia-exoplanetas",
    userInput: {
      chapterDescription:
        "Seguirás la revolución de los exoplanetas: métodos de detección, tránsito, velocidad radial, atmósferas y búsqueda de mundos habitables. También revisarás qué pueden y qué no pueden decir hoy los datos sobre vida fuera de la Tierra.",
      chapterTitle: "Exoplanetas",
      courseTitle: "Astronomía",
      language: "es",
      neighboringChapters: [
        {
          description:
            "Estudiarás el gran cambio reciente de la disciplina: detección de ondas gravitacionales, qué eventos las producen y cómo se combinan con señales de luz. Verás cómo nació la astronomía multimensajero y qué problemas permitió resolver.",
          title: "Ondas gravitacionales",
        },
        {
          description:
            "Verás otro pilar nuevo: neutrinos cósmicos, rayos cósmicos y cómo se conectan con explosiones, agujeros negros y objetos extremos. Este capítulo completa la visión moderna del universo observada con mensajeros no tradicionales.",
          title: "Neutrinos y partículas del cosmos",
        },
        {
          description:
            "Aquí aparecen las grandes encuestas del cielo, la astronomía de datos y el uso actual de IA para clasificar, detectar anomalías y manejar volúmenes masivos de observaciones. Es ya parte normal de la práctica moderna, no un tema opcional.",
          title: "Astronomía de datos e inteligencia artificial",
        },
        {
          description:
            "Verás cómo se diseña y ejecuta una investigación astronómica completa: pregunta, propuesta de observación, toma de datos, reducción, análisis, interpretación y publicación. Esto une la teoría con la práctica real de la disciplina.",
          title: "De una pregunta a un resultado científico",
        },
      ],
    },
  },
  // Late chapter: expert-level technical depth
  {
    expectations: `
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-machine-learning-transformers",
    userInput: {
      chapterDescription:
        "Transformers changed how ML handles language, vision, audio, and multimodal data. This chapter covers attention, encoder-decoder designs, pretraining patterns, and why transformers replaced many older architectures.",
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Models in production need packaging, serving, scaling, rollback plans, observability, and incident handling. This chapter covers deployment patterns for batch, streaming, and real-time inference.",
          title: "Serving Models",
        },
        {
          description:
            "Once models are live, teams need monitoring, retraining rules, feature stores, lineage, governance, and automation. This chapter covers the operational side of ML systems that people now call MLOps.",
          title: "MLOps",
        },
        {
          description:
            "Foundation models and large language models created new ways to build products and research systems. This chapter covers prompting, context windows, tool use, evaluation, and the strengths and limits of LLM-based systems.",
          title: "Large Language Models",
        },
        {
          description:
            "Many modern applications improve LLMs by connecting them to external knowledge. This chapter covers embeddings, chunking, indexing, retrieval, reranking, grounding, and failure modes in retrieval-augmented generation systems.",
          title: "RAG Systems",
        },
      ],
    },
  },
];
