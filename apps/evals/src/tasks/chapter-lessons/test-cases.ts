const SHARED_EXPECTATIONS = `
  - Each lesson should cover a SINGLE, SPECIFIC concept that can be explained within 10 short tweets
  - Break down topics into the smallest, most manageable units possible, so that each lesson can be learned in 2-3 minutes
  - If a topic is too broad, split it into multiple lessons
  - Each lesson should be extremely focused on a SINGLE concept
  - If a lesson is too broad, split it into multiple lessons
  - Each lesson must cover a SINGLE concept. Using "AND", "OR", "VS" (or equivalents in other languages like "e", "ou", "y", "o") in a title is a signal it MAY be too broad — but it is acceptable when the comparison or pairing IS the concept itself (e.g., "DEPT-90 y DEPT-135" where distinguishing two NMR techniques is the lesson, or "IPv4 vs. IPv6 Format" where the format contrast is one concept). Only penalize when AND/OR/VS joins genuinely separate concepts that deserve their own lessons (e.g., "Strings and Lists" where each is a full topic)
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
  - Include an extensive list of lessons to fully cover the chapter's scope. The key metric is completeness: are all concepts in the chapter description adequately covered with sufficient granularity? Broad technical chapters (e.g., web fundamentals, Python basics) typically need 80-120+ lessons. Narrower or more specialized chapters (e.g., legal theory of evidence, NMR spectroscopy) may need fewer if the domain is inherently smaller — do not penalize for fewer lessons if the chapter's scope is fully covered

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
      - Should NOT create dedicated lessons teaching browser rendering engines/pipelines (neighboring chapter "Browsers and rendering pipelines" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching URL parsing or URI components (neighboring chapter "URL anatomy and addressing" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching HTTP methods, status codes, or headers (neighboring chapter "HTTP fundamentals" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-how-the-web-works",
    userInput: {
      chapterDescription:
        "Core concepts of clients, servers, IP, DNS, HTTP/HTTPS, TLS, proxies, caching, cookies, and CDNs.",
      chapterTitle: "How the web works",
      courseTitle: "Web Development",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Roles of browsers, rendering engines, JavaScript engines, event loops, process models, and browser security boundaries.",
          title: "Browsers and rendering pipelines",
        },
        {
          description:
            "URLs, URI components, content negotiation, character encodings, and internationalized domain names.",
          title: "URL anatomy and addressing",
        },
        {
          description:
            "HTTP methods, status codes, headers, caching directives, idempotency, and connection management.",
          title: "HTTP fundamentals",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down each data type into separate lessons
      - Should cover syntax fundamentals as individual concepts
      - Basic I/O should be separate from data types and operators
      - Should NOT create dedicated lessons teaching installation, virtual environments, or project setup (neighboring chapter "Ambiente Python e ferramentas essenciais" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching code style, PEP 8, or linters (neighboring chapter "Estilo de código e legibilidade" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching operators or precedence in depth (neighboring chapter "Operadores e expressões" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching control flow or conditionals (neighboring chapter "Controle de fluxo: condicionais" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-fundamentos",
    userInput: {
      chapterDescription:
        "Sintaxe, indentação, comentários, tipos numéricos, booleanos, strings, entrada/saída e operações básicas.",
      chapterTitle: "Fundamentos da linguagem",
      courseTitle: "Python",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Instalação, múltiplas versões, ambientes virtuais, dependências, layout de projetos e execução de scripts e módulos.",
          title: "Ambiente Python e ferramentas essenciais",
        },
        {
          description: "Nomes, escopo, convenções, PEP 8, formatação, linters e análise estática.",
          title: "Estilo de código e legibilidade",
        },
        {
          description:
            "Operadores aritméticos, comparação, lógicos, bitwise, precedência e armadilhas comuns.",
          title: "Operadores e expressões",
        },
        {
          description: "if/elif/else, match/case, expressões condicionais e padrões de validação.",
          title: "Controle de fluxo: condicionais",
        },
      ],
    },
  },
  // Mid-course chapters
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should separate 1D NMR concepts from 2D NMR techniques
      - Chemical shifts, coupling, and integration should be distinct lessons
      - Should break down structural elucidation into individual steps/techniques
      - Should NOT create dedicated lessons teaching UV-Vis spectroscopy (neighboring chapter "UV-Vis" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching IR or Raman spectroscopy (neighboring chapter "IR y Raman" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching EPR/ESR or paramagnetic resonance (neighboring chapter "Resonancia paramagnética electrónica" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching mass spectrometry (neighboring chapter "Espectrometría de masas" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-resonancia-magnetica",
    userInput: {
      chapterDescription:
        "RMN: desplazamiento químico, acoplamiento, integración, RMN 2D y elucidación estructural.",
      chapterTitle: "Resonancia magnética nuclear",
      courseTitle: "Química",
      language: "es",
      neighboringChapters: [
        {
          description:
            "Espectroscopía UV-Vis: transiciones, ley de Beer–Lambert, instrumentación y análisis cuantitativo.",
          title: "UV-Vis",
        },
        {
          description:
            "Fluorescencia y fosforescencia: rendimiento cuántico, apagamiento, sondas y aplicaciones.",
          title: "Espectroscopía de luminiscencia",
        },
        {
          description:
            "IR y Raman: modos vibracionales, selección, interpretación estructural y efectos del solvente.",
          title: "IR y Raman",
        },
        {
          description:
            "EPR/ESR: radicales, centros paramagnéticos, hiperfino y aplicaciones en materiales y bioquímica.",
          title: "Resonancia paramagnética electrónica",
        },
        {
          description:
            "Espectrometría de masas: ionización, analizadores, fragmentación y asignación de estructuras.",
          title: "Espectrometría de masas",
        },
        {
          description:
            "Difracción de rayos X: Bragg, refinamiento, cristalografía de moléculas y sólidos; limitaciones.",
          title: "Cristalografía de rayos X",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should separate stylized facts from theoretical models
      - Should cover each type of indicator individually
      - Should distinguish business cycle measurement from theory
      - Should NOT create dedicated lessons teaching GDP measurement or national accounts (neighboring chapter "Macroeconomic statistics" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching money supply or quantity theory of money (neighboring chapter "Money and inflation" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching IS-LM or aggregate demand/supply models (neighboring chapter "Short-run macro frameworks" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching consumption theory or life-cycle models (neighboring chapter "Consumption in macroeconomics" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-business-cycles",
    userInput: {
      chapterDescription:
        "Business cycle facts: stylized facts, co-movements, and leading indicators.",
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Firms in development: management practices, informality, and productivity dispersion.",
          title: "Firms and productivity in development",
        },
        {
          description:
            "Macroeconomic measurement: GDP, GNI, inflation, unemployment, and national accounts frameworks.",
          title: "Macroeconomic statistics",
        },
        {
          description:
            "Money and inflation: quantity theory, money demand, and inflation dynamics.",
          title: "Money and inflation",
        },
        {
          description:
            "Short-run fluctuations: IS–LM intuition, aggregate demand/supply, and policy transmission.",
          title: "Short-run macro frameworks",
        },
        {
          description:
            "Consumption theory in macro: permanent income, life-cycle models, and empirical puzzles.",
          title: "Consumption in macroeconomics",
        },
        {
          description:
            "Investment: q-theory, adjustment costs, uncertainty, and financial frictions.",
          title: "Investment dynamics",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down Definition of Ready components individually
      - Should cover story refinement techniques as separate lessons
      - Should NOT create dedicated lessons teaching estimation techniques, story points, or planning poker (neighboring chapters "Estimativas em ágil" and "Story points e planning poker" cover that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching no-estimates or throughput forecasting (neighboring chapter "No-estimates e previsões por fluxo" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching risk management or dependency mapping (neighboring chapter "Risco e dependências" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching software architecture or SOLID principles (neighboring chapter "Arquitetura em contextos ágeis" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-definition-of-ready",
    userInput: {
      chapterDescription:
        "Refinamento contínuo com DoR, preparação de histórias e alinhamento técnico.",
      chapterTitle: "Definition of Ready e preparo do trabalho",
      courseTitle: "Metodologias Ágeis",
      language: "pt",
      neighboringChapters: [
        {
          description: "Estimativas: por que, quando e quando não; vieses e variabilidade.",
          title: "Estimativas em ágil",
        },
        {
          description:
            "Story points, escalas, planning poker e calibração; cuidados com comparações entre times.",
          title: "Story points e planning poker",
        },
        {
          description:
            "Estimativas por fluxo: no-estimates, throughput e previsões probabilísticas.",
          title: "No-estimates e previsões por fluxo",
        },
        {
          description: "Gestão de riscos, premissas e dependências; integração com planejamento.",
          title: "Risco e dependências",
        },
        {
          description:
            "Arquitetura evolutiva, modularidade e fitness functions; evitar big design up front.",
          title: "Arquitetura em contextos ágeis",
        },
        {
          description:
            "Princípios SOLID, coesão/acoplamento e técnicas para manter código sustentável.",
          title: "Design de software para agilidade",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should cover each Horcrux-related concept separately
      - Should distinguish between Deathly Hallows and Horcruxes as separate topics
      - Should break down moral and philosophical implications as individual lessons
      - Even though this is pop culture, lessons should still be focused and granular
      - Should NOT create dedicated lessons teaching Legilimency, Occlumency, or mind magic (neighboring chapter "Magic: Mind Arts" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching time-turners or time magic (neighboring chapter "Magic: Time and Paradox" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching protective wards or the Fidelius Charm (neighboring chapter "Magic: Wards and Secret-Keeping" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching curse-breaking techniques (neighboring chapter "Magic: Curses and Curse-Breaking" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-harry-potter-death-souls",
    userInput: {
      chapterDescription:
        "Deathly magic: Horcruxes, Hallows, and how immortality attempts reshape morality.",
      chapterTitle: "Magic: Death, Souls, and Immortality",
      courseTitle: "Harry Potter",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Healing potions and antidotes; triage, toxicity, and counter-poison strategies.",
          title: "Magic: Antidotes and Healing Potions",
        },
        {
          description:
            "Mind magic: Legilimency, Occlumency, and memory manipulation tradeoffs and risks.",
          title: "Magic: Mind Arts",
        },
        {
          description:
            "Time magic: time-turners, paradox avoidance, and narrative constraints on temporal tools.",
          title: "Magic: Time and Paradox",
        },
        {
          description:
            "Protective enchantments: Fidelius, blood wards, and layered security design.",
          title: "Magic: Wards and Secret-Keeping",
        },
        {
          description: "Curses and curse-breaking: detection, containment, and reversal methods.",
          title: "Magic: Curses and Curse-Breaking",
        },
        {
          description:
            "Artifacts with agency: cursed objects, sentient items, and ownership/allegiance effects.",
          title: "Magic: Enchanted Objects and Sentience",
        },
      ],
    },
  },
  // Late/final chapters
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should cover each type of evidence individually
      - Should separate burden of proof from standards of proof
      - Should break down presumptions as individual concepts
      - Should NOT create dedicated lessons teaching forensic/technical evidence or perícias (neighboring chapter "Perícias e prova técnica" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching legal risk management (neighboring chapter "Risk management jurídico" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching precedent analysis or jurisprudence (neighboring chapter "Análise de precedentes" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching strategic litigation or amici curiae (neighboring chapter "Litigância estratégica e impacto" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-teoria-geral-da-prova",
    userInput: {
      chapterDescription:
        "Direito probatório: standards de prova, ônus, inversão, presunções e prova estatística.",
      chapterTitle: "Teoria geral da prova",
      courseTitle: "Direito",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Gestão de riscos jurídicos: mapeamento, matriz de riscos, controles, apetite a risco e relatórios.",
          title: "Risk management jurídico",
        },
        {
          description:
            "Privilegios e confidencialidade: sigilo profissional, attorney-client privilege comparado e governança de dados.",
          title: "Sigilo, confidencialidade e privilégio",
        },
        {
          description:
            "Provas e perícias: perícia contábil, técnica, grafotécnica, médica, ambiental e quesitação.",
          title: "Perícias e prova técnica",
        },
        {
          description:
            "Jurisprudência e precedentes: ratio decidendi, distinguishing, overruling e consistência decisória.",
          title: "Análise de precedentes",
        },
        {
          description:
            "Litigância estratégica: seleção de casos, construção de teses, amici curiae e impacto sistêmico.",
          title: "Litigância estratégica e impacto",
        },
        {
          description:
            "Processos estruturais e políticas públicas: decisões complexas, monitoramento, compliance judicial e consensualidade.",
          title: "Processo estrutural",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should break down each thematic continuity into separate lessons
      - Should cover slavery's legacy aspects individually
      - Should separate political, economic, and social themes into distinct lessons
      - Should NOT create dedicated lessons teaching about museums, monuments, or public history (neighboring chapter "Public history and collective memory" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching comparative parallels with other countries (neighboring chapter "Brazil in comparative perspective" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching career advice or academic pathways (neighboring chapter "Careers in Brazilian history and related fields" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-continuities",
    userInput: {
      chapterDescription:
        "Long-run themes: slavery's legacies, state capacity, inequality, and democracy's cycles.",
      chapterTitle: "Continuities and turning points in Brazilian history",
      courseTitle: "Brazilian History",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Quantitative and spatial methods: census data, economic series, GIS mapping, and digital humanities.",
          title: "Data and digital methods in history",
        },
        {
          description:
            "Memory, monuments, and public history: museums, curriculum disputes, and politics of commemoration.",
          title: "Public history and collective memory",
        },
        {
          description:
            "Comparative Brazil: parallels with Spanish America, the US South, and Atlantic empires.",
          title: "Brazil in comparative perspective",
        },
        {
          description:
            "Key academic pathways, language skills, archives, fellowships, and career options in research, education, and policy.",
          title: "Careers in Brazilian history and related fields",
        },
      ],
    },
  },
];
