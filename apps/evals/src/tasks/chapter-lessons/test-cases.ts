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
  - Should follow the language specified by language parameter
  - Should follow title and description guidelines: no fluff, be concise, straight to the point
  - Descriptions should be concise and straight to the point, no fluff/filler words (avoid "learn", "understand", "explore", "introduction to", etc.)
  - You don't need to evaluate the output format here, just focus on the lesson content quality
  - Include an extensive list of lessons to cover all the concepts needed to learn the chapter. Complex topics will usually requiere more than 100 lessons
  
  Things to check:
  - Is each lesson too broad? If so, it should be broken down further
  - Can each concept be explained in 10 short tweets or less? If not, it should be broken down
  - Does each lesson focus on a single specific concept? If not, it should be split
  - Does it have lessons that don't belong in this chapter? If so, they should be removed
`;

export const TEST_CASES = [
  // Initial chapters (beginning of courses)
  {
    expectations: `
      - MUST be in US English
      - Should break down networking concepts individually (DNS, HTTP, TLS as separate lessons)
      - Should separate client-side from server-side concepts
      - Should cover each protocol and technology as its own lesson
      - Should not group unrelated concepts (e.g., not "DNS and HTTP" but separate lessons)
      - Should NOT cover browser rendering engines/pipelines (covered in "Browsers and rendering pipelines" chapter)
      - Should NOT cover URL parsing or URI components (covered in "URL anatomy and addressing" chapter)
      - Should NOT cover HTTP methods, status codes, or headers in depth (covered in "HTTP fundamentals" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-how-the-web-works",
    userInput: {
      chapterDescription:
        "Core concepts of clients, servers, IP, DNS, HTTP/HTTPS, TLS, proxies, caching, cookies, and CDNs.",
      chapterTitle: "How the web works",
      courseTitle: "Web Development",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down each data type into separate lessons
      - Should cover syntax fundamentals as individual concepts
      - Basic I/O should be separate from data types and operators
      - Should NOT cover installation, virtual environments, or project setup (covered in "Ambiente Python e ferramentas essenciais" chapter)
      - Should NOT cover code style, PEP 8, or linters (covered in "Estilo de código e legibilidade" chapter)
      - Should NOT cover operators or precedence in depth (covered in "Operadores e expressões" chapter)
      - Should NOT cover control flow or conditionals (covered in "Controle de fluxo: condicionais" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-fundamentos",
    userInput: {
      chapterDescription:
        "Sintaxe, indentação, comentários, tipos numéricos, booleanos, strings, entrada/saída e operações básicas.",
      chapterTitle: "Fundamentos da linguagem",
      courseTitle: "Python",
      language: "pt",
    },
  },
  // Mid-course chapters
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should separate 1D NMR concepts from 2D NMR techniques
      - Chemical shifts, coupling, and integration should be distinct lessons
      - Should break down structural elucidation into individual steps/techniques
      - Should NOT cover UV-Vis spectroscopy (covered in "UV-Vis" chapter)
      - Should NOT cover IR or Raman spectroscopy (covered in "IR y Raman" chapter)
      - Should NOT cover EPR/ESR or paramagnetic resonance (covered in "Resonancia paramagnética electrónica" chapter)
      - Should NOT cover mass spectrometry (covered in "Espectrometría de masas" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-resonancia-magnetica",
    userInput: {
      chapterDescription:
        "RMN: desplazamiento químico, acoplamiento, integración, RMN 2D y elucidación estructural.",
      chapterTitle: "Resonancia magnética nuclear",
      courseTitle: "Química",
      language: "es",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should separate stylized facts from theoretical models
      - Should cover each type of indicator individually
      - Should distinguish business cycle measurement from theory
      - Should NOT cover GDP measurement or national accounts (covered in "Macroeconomic statistics" chapter)
      - Should NOT cover money supply or quantity theory of money (covered in "Money and inflation" chapter)
      - Should NOT cover IS-LM or aggregate demand/supply models (covered in "Short-run macro frameworks" chapter)
      - Should NOT cover consumption theory or life-cycle models (covered in "Consumption in macroeconomics" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-business-cycles",
    userInput: {
      chapterDescription:
        "Business cycle facts: stylized facts, co-movements, and leading indicators.",
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down Definition of Ready components individually
      - Should cover story refinement techniques as separate lessons
      - Should NOT cover estimation techniques, story points, or planning poker (covered in "Estimativas em ágil" and "Story points e planning poker" chapters)
      - Should NOT cover no-estimates or throughput forecasting (covered in "No-estimates e previsões por fluxo" chapter)
      - Should NOT cover risk management or dependency mapping (covered in "Risco e dependências" chapter)
      - Should NOT cover software architecture or SOLID principles (covered in "Arquitetura em contextos ágeis" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-definition-of-ready",
    userInput: {
      chapterDescription:
        "Refinamento contínuo com DoR, preparação de histórias e alinhamento técnico.",
      chapterTitle: "Definition of Ready e preparo do trabalho",
      courseTitle: "Metodologias Ágeis",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should cover each Horcrux-related concept separately
      - Should distinguish between Deathly Hallows and Horcruxes as separate topics
      - Should break down moral and philosophical implications as individual lessons
      - Even though this is pop culture, lessons should still be focused and granular
      - Should NOT cover Legilimency, Occlumency, or mind magic (covered in "Magic: Mind Arts" chapter)
      - Should NOT cover time-turners or time magic (covered in "Magic: Time and Paradox" chapter)
      - Should NOT cover protective wards or the Fidelius Charm (covered in "Magic: Wards and Secret-Keeping" chapter)
      - Should NOT cover curse-breaking techniques (covered in "Magic: Curses and Curse-Breaking" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-harry-potter-death-souls",
    userInput: {
      chapterDescription:
        "Deathly magic: Horcruxes, Hallows, and how immortality attempts reshape morality.",
      chapterTitle: "Magic: Death, Souls, and Immortality",
      courseTitle: "Harry Potter",
      language: "en",
    },
  },
  // Late/final chapters
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should cover each type of evidence individually
      - Should separate burden of proof from standards of proof
      - Should break down presumptions as individual concepts
      - Should NOT cover forensic/technical evidence or perícias (covered in "Perícias e prova técnica" chapter)
      - Should NOT cover legal risk management (covered in "Risk management jurídico" chapter)
      - Should NOT cover precedent analysis or jurisprudence (covered in "Análise de precedentes" chapter)
      - Should NOT cover strategic litigation or amici curiae (covered in "Litigância estratégica e impacto" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-teoria-geral-da-prova",
    userInput: {
      chapterDescription:
        "Direito probatório: standards de prova, ônus, inversão, presunções e prova estatística.",
      chapterTitle: "Teoria geral da prova",
      courseTitle: "Direito",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should break down each thematic continuity into separate lessons
      - Should cover slavery's legacy aspects individually
      - Should separate political, economic, and social themes into distinct lessons
      - Should NOT cover museums, monuments, or public history (covered in "Public history and collective memory" chapter)
      - Should NOT cover comparative parallels with other countries (covered in "Brazil in comparative perspective" chapter)
      - Should NOT cover career advice or academic pathways (covered in "Careers in Brazilian history and related fields" chapter)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-continuities",
    userInput: {
      chapterDescription:
        "Long-run themes: slavery's legacies, state capacity, inequality, and democracy's cycles.",
      chapterTitle: "Continuities and turning points in Brazilian history",
      courseTitle: "Brazilian History",
      language: "en",
    },
  },
];
