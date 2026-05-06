const SHARED_EXPECTATIONS = `
  - Mission context: this curriculum is for learners OUTSIDE privileged environments — people who doubt they can become serious practitioners. Chapters should feel welcoming and legible, not gate-kept by academic vocabulary
  - MAJOR ERROR: the curriculum must be a serious arc from zero knowledge to mastery, not a shallow tour or a list of disconnected topics
  - MAJOR ERROR: chapters must follow a logical learning progression. Each chapter should depend only on earlier chapters and ordinary life experience a true beginner can reasonably have
  - MAJOR ERROR: the opening chapters must teach the natural foundations a true beginner needs first
  - MAJOR ERROR: practical work must appear throughout the course once prerequisites support it. A curriculum that stays purely theoretical or avoids projects, tools, cases, techniques, artifacts, and workflows is incomplete
  - MAJOR ERROR: opening with a showcase project, specialist case, lab technique, advanced tool, or dramatic scenario before the learner has the prerequisites is wrong even when the example is real and concrete
  - For chronological subjects, the chapter order must follow the real chronology. For skill-based subjects, it must follow the real skill progression. For science and engineering, observable foundations should come before specialist techniques
  - Foundational chapters are allowed and often necessary, but they must teach concrete concepts, vocabulary, chronology, notation, mental models, or simple skills the learner will use later — not just describe the field from the outside
  - Chapter count is a RESULT of coverage, not a target. Do not penalize or reward specific counts when coverage is justified. Evaluate whether every canonical pillar of the field has at least one chapter — if any pillar is missing, the curriculum is incomplete regardless of count. Broad fields, large platforms, and large fictional canons can legitimately need many chapters. Penalize duplicate, padded, or poorly sequenced chapters, not length by itself
  - MAJOR ERROR: trading breadth for recency. Modern topics must ADD coverage without REPLACING canonical foundations. For example, a machine learning curriculum that covers transformers/LLMs/RAG/diffusion/fine-tuning but drops reinforcement learning, time-series forecasting, recommender systems, or causal inference is incomplete — those are canonical ML pillars. A medicine curriculum that covers telemedicine and modern EMRs but drops anatomy, physiology, pathology, or pharmacology is incomplete. If covering everything needs more chapters, more chapters is the correct answer
  - Must cover BOTH academic AND practical pillars:
    - Academic pillars: theory, foundations, history, canonical body of knowledge
    - Modern toolchain: what working practitioners in this field actually use this year
    - End-to-end workflow: at least one chapter walking through how real work in the field gets delivered start to finish
    - Last-decade shifts: what's been added to the field in the past 10 years that a textbook wouldn't have covered 10 years ago (new regulations, new platforms, new techniques, AI changes, etc.)
  - MAJOR ERROR: for broad fields, professions, sciences, engineering subjects, and serious practices, missing a standalone history/evolution chapter is an academic-pillar gap unless the course itself is already chronological history or the subject is a narrow tool/hobby where history would be padding
  - MAJOR ERROR: for fields, professions, and serious practices, missing a standalone end-to-end workflow chapter is a practical-pillar gap. The workflow should show real work from problem/request/question through decisions, execution, validation, delivery, operation, maintenance, or follow-up, depending on the field
  - For regulated professions and fields with safety duties, local rules, required documents, reporting duties, professional responsibility, and safety practice are curriculum pillars. A generic ethics chapter is not enough when practitioners need separate procedures and judgment
  - The "junior practitioner test": if a junior would be embarrassed on day 1 of real practice because a topic is missing, that topic must exist as its own chapter
  - Cover core pillars before specialized or frontier topics
  - Stay tightly focused on the course title. Generic cross-disciplinary chapters that could be copied unchanged into many unrelated courses are a major error unless the topic IS the subject of the course
  - MAJOR ERROR: meta-chapters that describe, taxonomize, or survey the field from the outside instead of teaching it
  - MAJOR ERROR: survey chapters that list many areas as bullet points without teaching any of them — each topic that matters deserves its own chapter with real depth
  - MAJOR ERROR: catch-all "recent developments" chapters. Titles like "Catch up with the last decade of X", "What's new in X", "Recent developments in X", "The last decade of X", or "Modern X" that bundle multiple distinct modern techniques into a single chapter are a major error. Each modern shift (transformers, LLMs, RAG, diffusion, fine-tuning for ML; CRISPR, sequencing, single-cell biology, spatial omics, synthetic biology for Biology; LGPD/GDPR, digital filing for Law; telemedicine, EMRs for Medicine; etc.) deserves its own substantive chapter
  - Avoid overlap. If two chapters would naturally share most of their lessons, they should be merged or their scopes sharpened
  - Prefer concept names over vendor names in chapter titles/descriptions (e.g., "Package management" instead of a specific tool name). Foundational tools that ARE the subject of the course are an allowed exception. Vendor name usage in non-vendor courses is a minor issue, never a major error
  - For courses covering a field, profession, or serious practice, a "navigating the field" closing chapter is expected. It must cover ROLES AND SPECIALTIES (what kinds of practitioners exist and what they do differently), CONTRIBUTION/ENTRY PATHS (how people actually join — jobs, residencies, open source, communities), the ARTIFACT THAT PROVES COMPETENCE in this field (code repos, case records, clinical hours, recordings), and HOW PRACTITIONERS KEEP SKILLS CURRENT. A narrow "Build a Portfolio" or "Build a Project" closing chapter is a major error — a portfolio is just one small part of navigating a field. The closing chapter must be specific to the subject, not generic career advice
  - For hobby / pop-culture topics, no closing navigation chapter is expected
  - Titles: concise, specific, concrete, natural, learner-facing, and sentence case. Preserve normal capitalization for proper nouns, product names, acronyms, and language-specific conventions. MAJOR STYLE ISSUE: titles that read like academic catalog entries, textbook section headings, taxonomy labels, comma-separated topic inventories, abstract noun stacks, or title-case headlines when a relevance-forward title could name the same chapter. Prefer titles that name the real topic through what it does, what it changes, where it shows up, or what the learner will be able to handle. Examples: "Cells that divide" is better than "Cell division and genetic reproduction"; "Fungi that recycle the world" is better than "Protists, fungi, and algae"; "Keep track of changes with Git" is better than "Version control with Git"; "Catch bugs before users do" is better than "Testing JavaScript code". Avoid vague, cute, clickbait, or slogan-like titles such as "X Without Fear" unless that phrase is the natural name of the topic. Avoid "I / II / Part 1" — use descriptive subtitles instead
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
      - Must include a dedicated chapter on the history and evolution of Brazilian law and institutions. Treating current branches of law as enough without the historical/institutional pillar is incomplete

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito",
    userInput: { courseTitle: "Direito", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Must cover the full clinical workflow (anamnesis → exam → diagnosis → treatment → follow-up) and the regulatory/practical reality of Brazilian medicine (SUS, CFM, prescription rules), not just textbook theory
      - Must include substantive dedicated coverage of Brazilian medical regulation and professional/legal duties: SUS, CFM/CRM rules, medical responsibility, controlled-substance prescriptions, prescription types, telemedicine norms, certificates/atestados, death documentation, and notifiable/legal duties

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-medicina",
    userInput: { courseTitle: "Medicina", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Must preserve computer science as the subject, with recognizable coverage of programming, algorithms, data structures, systems, databases, networks, software engineering, security, AI, and theory — not generic digital literacy or productivity with computers
      - Must include a dedicated history/evolution chapter for computing, including major eras, hardware/software shifts, networks, operating systems, the web, open source, mobile/cloud, and AI-era changes where relevant
      - Must include a dedicated end-to-end delivery workflow chapter showing how real CS/software work goes from problem framing through design, implementation, testing, delivery, operation, and maintenance
      - Modern CS must be substantive, not compressed into generic AI/cloud chapters. Expect separate coverage for cloud-native infrastructure, containers/Kubernetes, CI/CD, observability, supply-chain security, data engineering, GPUs, embedded/IoT, WebAssembly, ML/deep learning, transformers, LLMs/foundation models, RAG, fine-tuning, diffusion models, AI-assisted programming, recommender systems, and reinforcement learning where they fit the full field

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ciencia-da-computacao",
    userInput: { courseTitle: "Ciência da Computação", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Must cover biology as a full scientific field: molecules and cells, genetics, evolution, physiology, ecology, biodiversity, lab methods, and modern bioinformatics/biotechnology. A curriculum that only surveys animals/plants/ecology, or only stays at textbook taxonomy, is incomplete
      - Modern biology must be substantive, not compressed into one broad bioinformatics or biotechnology chapter. Expect separate coverage for computational biology, biological databases, DNA techniques, next-generation sequencing, long-read sequencing, CRISPR, single-cell biology, spatial omics, microbiomes/environmental DNA, synthetic biology, protein structure with AI, and modern biological imaging where they fit the full field
      - Must include a standalone substantive biosafety chapter. Brief mentions inside lab methods, fieldwork, biocontainment, or ethics are not enough

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia",
    userInput: { courseTitle: "Biologia", language: "pt" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Must include a dedicated history/evolution chapter covering major Formula 1 technical eras, regulation changes, safety-driven design shifts, and why modern F1 cars became what they are
      - Must include dedicated finite element analysis / structural simulation coverage for chassis, suspension, composites, crash structures, and lightweight part design

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-engenharia-formula-1",
    userInput: { courseTitle: "Engenharia de Fórmula 1", language: "pt" },
  },
  {
    expectations: `
      - MUST be in US English
      - Naming Google Cloud vendor and its product names IS expected here — the vendor IS the subject, so it's an allowed exception to the vendor-naming rule
      - Must cover flagship Google Cloud services that define the platform's architecture story. Cloud Spanner should appear as standalone database coverage, not be hidden inside a generic database chapter

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-google-cloud",
    userInput: { courseTitle: "Google Cloud", language: "en" },
  },
  {
    expectations: `
      - MUST be in US English
      - This is a hobby / interest topic, so no career chapter is expected. Do not penalize the course for having many chapters if the chapters follow the canon, avoid padding, and remain welcoming for beginners

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-dragon-ball",
    userInput: { courseTitle: "Dragon Ball", language: "en" },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Must include a dedicated history/development chapter for astronomy. It should cover the major arc from ancient sky models through the geocentric-to-heliocentric shift, early modern astronomy, spectroscopy, relativity, the expanding universe, and modern observational astronomy. Do not require every named milestone to appear in that one chapter description if related dedicated chapters cover them clearly elsewhere

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-astronomia",
    userInput: { courseTitle: "Astronomía", language: "es" },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Must cover both theory (harmony, rhythm, notation, music history) AND practice (instrument technique, ensemble, performance, modern production/DAW tools), not just one side
      - Must not compress major traditions or eras into broad survey chapters. Western classical eras, Latin American traditions, blues, jazz, rock, pop, hip hop, electronic music, and other major popular traditions should be split into meaningful eras, families, or practice areas instead of bundled into one catch-all list

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
