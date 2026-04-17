const SHARED_EXPECTATIONS = `
  - Mission context: this curriculum is for learners OUTSIDE privileged environments — people who doubt they can become serious practitioners. Chapters should feel welcoming and legible, not gate-kept by academic vocabulary
  - MAJOR ERROR: the first chapter must hook the learner IN the subject with REAL problems, REAL artifacts, REAL techniques, REAL cases, or REAL tools. After chapter 1 the learner should think "I want to learn how to do this", not "OK, now I know what this field is about"
  - MAJOR ERROR: forbidden first-chapter patterns — "What is X" / "Introduction to X" / "Overview of X" / "Panorama of X" / "Why X matters" / "When human effort isn't enough" / any chapter whose lessons would be ABOUT the field (its definition, taxonomy, history from the outside) rather than IN the field
  - MAJOR ERROR: hands-on does NOT mean advanced. The first chapter must ALSO be beginner-accessible — the simplest concrete entry point a true beginner can follow without prerequisites the course hasn't taught yet. Opening with a dramatic, specialized, or impressive-sounding example that requires skipped prerequisites (e.g., "acute chest pain in the emergency room" as chapter 1 of Medicine before anatomy/physiology, or "detect an exoplanet via light curve" as chapter 1 of Astronomy before the learner knows what a light curve is) is a major error — even though the example is real and concrete
  - MAJOR ERROR: ignoring natural starting points. For chronological subjects (history, long narratives), chapter 1 must open in the EARLY period of the course's chronology through a concrete document, figure, or artifact — skipping ahead to a dramatic later event (e.g., opening a "Brazilian History" course with the 1964 military coup instead of the colonial period) is a major error. For subjects with a skill progression (music, medicine, crafts), chapter 1 must start at the simplest real task a beginner can actually do, not a specialized scenario
  - First-chapter sanity test: "would a true beginner plausibly encounter this first?" If the answer requires skipping prerequisites or skipping the natural chronology/progression of the field, the hook is wrong
  - The curriculum must be a serious arc from beginner to real competence, not a shallow tour
  - Chapter count is a RESULT of coverage, not a target. Do not penalize or reward specific counts. Evaluate whether every canonical pillar of the field has at least one chapter — if any pillar is missing, the curriculum is incomplete regardless of count. Broad fields naturally need many chapters; narrow tools and hobby topics naturally need fewer
  - MAJOR ERROR: trading breadth for recency. Modern topics must ADD coverage without REPLACING canonical foundations. For example, a machine learning curriculum that covers transformers/LLMs/RAG/diffusion/fine-tuning but drops reinforcement learning, time-series forecasting, recommender systems, or causal inference is incomplete — those are canonical ML pillars. A medicine curriculum that covers telemedicine and modern EMRs but drops anatomy, physiology, pathology, or pharmacology is incomplete. If covering everything needs more chapters, more chapters is the correct answer
  - Must cover BOTH academic AND practical pillars:
    - Academic pillars: theory, foundations, history, canonical body of knowledge
    - Modern toolchain: what working practitioners in this field actually use this year
    - End-to-end workflow: at least one chapter walking through how real work in the field gets delivered start to finish
    - Last-decade shifts: what's been added to the field in the past 10 years that a textbook wouldn't have covered 10 years ago (new regulations, new platforms, new techniques, AI changes, etc.)
  - The "junior practitioner test": if a junior would be embarrassed on day 1 of real practice because a topic is missing, that topic must exist as its own chapter
  - Cover core pillars before specialized or frontier topics
  - Stay tightly focused on the course title. Generic cross-disciplinary chapters that could be copied unchanged into many unrelated courses are a major error unless the topic IS the subject of the course
  - MAJOR ERROR: meta-chapters that describe, taxonomize, or survey the field from the outside instead of teaching it
  - MAJOR ERROR: survey chapters that list many areas as bullet points without teaching any of them — each topic that matters deserves its own chapter with real depth
  - MAJOR ERROR: catch-all "recent developments" chapters. Titles like "Catch up with the last decade of X", "What's new in X", "Recent developments in X", "The last decade of X", or "Modern X" that bundle multiple distinct modern techniques into a single chapter are a major error. Each modern shift (transformers, LLMs, RAG, diffusion, fine-tuning for ML; LGPD/GDPR, digital filing for Law; telemedicine, EMRs for Medicine; etc.) deserves its own substantive chapter
  - Avoid overlap. If two chapters would naturally share most of their lessons, they should be merged or their scopes sharpened
  - Prefer concept names over vendor names in chapter titles/descriptions (e.g., "Package management" instead of a specific tool name). Foundational tools that ARE the subject of the course are an allowed exception. Vendor name usage in non-vendor courses is a minor issue, never a major error
  - For courses covering a field, profession, or serious practice, a "navigating the field" closing chapter is expected. It must cover ROLES AND SPECIALTIES (what kinds of practitioners exist and what they do differently), CONTRIBUTION/ENTRY PATHS (how people actually join — jobs, residencies, open source, communities), the ARTIFACT THAT PROVES COMPETENCE in this field (code repos, case records, clinical hours, recordings), and HOW PRACTITIONERS KEEP SKILLS CURRENT. A narrow "Build a Portfolio" or "Build a Project" closing chapter is a major error — a portfolio is just one small part of navigating a field. The closing chapter must be specific to the subject, not generic career advice
  - For hobby / pop-culture topics, no closing navigation chapter is expected
  - Titles: short, specific, concrete. Prefer titles that name a real thing or answer a real question. Avoid "I / II / Part 1" — use descriptive subtitles instead. Academic catalog-style titles that read like a university transcript are a minor issue
  - Descriptions: 1–2 sentences describing what the chapter covers and, when natural, what it enables
  - MAJOR ERROR in descriptions: using the words "explore", "understand", "learn about", "introduction to", or "basics of". The prompt forbids them outright because they are warm-sounding filler that doesn't describe anything
  - Warm, plain language throughout. Avoid academic vocabulary
  - Language output must follow the language parameter. For \`en\`: US English. For \`pt\`: Brazilian Portuguese. For \`es\`: Latin American Spanish
  - Titles and descriptions must not leak prompt instructions or make claims about the learner's performance
  - Don't evaluate output format — focus on chapter content quality only
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST be in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript",
    userInput: { courseTitle: "JavaScript", language: "en" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Kanban is the subject itself, so naming Kanban-specific artifacts (board, WIP limits, classes of service, etc.) is expected and not a vendor violation

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-kanban",
    userInput: { courseTitle: "Kanban", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should cover Brazilian Law specifically (Constitution, civil, criminal, labor, tax, consumer, etc.), not generic comparative jurisprudence

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito",
    userInput: { courseTitle: "Direito", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Must cover the full clinical workflow (anamnesis → exam → diagnosis → treatment → follow-up) and the regulatory/practical reality of Brazilian medicine (SUS, CFM, prescription rules), not just textbook theory

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-medicina",
    userInput: { courseTitle: "Medicina", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-engenharia-formula-1",
    userInput: { courseTitle: "Engenharia de Fórmula 1", language: "pt" },
  },
  {
    expectations: `
      - MUST be in US English
      - Naming Google Cloud vendor and its product names IS expected here — the vendor IS the subject, so it's an allowed exception to the vendor-naming rule

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-google-cloud",
    userInput: { courseTitle: "Google Cloud", language: "en" },
  },
  {
    expectations: `
      - MUST be in US English
      - This is a hobby / interest topic, so no career chapter is expected and the hobby scope band (8–15 chapters) applies

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-dragon-ball",
    userInput: { courseTitle: "Dragon Ball", language: "en" },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-astronomia",
    userInput: { courseTitle: "Astronomía", language: "es" },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Must cover both theory (harmony, rhythm, notation, music history) AND practice (instrument technique, ensemble, performance, modern production/DAW tools), not just one side

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-musica",
    userInput: { courseTitle: "Música", language: "es" },
  },
  {
    expectations: `
      - MUST be in US English even though the subject is about Brazil. The language parameter controls the output language; the course title controls the subject. Writing the chapters in Portuguese is a major error
      - Chapter content should still be specific to Brazilian history (colonial period, empire, republic, military dictatorship, redemocratization, etc.), not generic world history

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history",
    userInput: { courseTitle: "Brazilian History", language: "en" },
  },
  {
    expectations: `
      - MUST be in US English
      - The modern toolchain and last-decade-shifts rules apply heavily here — most of this field IS the last decade. A curriculum that stops at classical ML (perceptrons, decision trees, SVMs, shallow neural networks) without covering transformers, large language models, fine-tuning, RAG, diffusion models, or modern training/serving infrastructure is a major error

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-machine-learning",
    userInput: { courseTitle: "Machine Learning", language: "en" },
  },
];
