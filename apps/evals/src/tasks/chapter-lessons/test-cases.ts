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

  Neighboring chapter scope judgment:
  - The chapter description is the SOURCE OF TRUTH for what is in-scope. Neighboring chapter constraints are guardrails against scope creep, NOT vetoes over topics listed in the chapter description
  - If a topic is explicitly mentioned in the chapter description, it is in-scope even if it touches on a neighboring chapter's domain (e.g., "Claisen" listed in a carbonyls chapter is in-scope even though esters have their own chapter)
  - The key test: does a lesson teach a topic AS ITS OWN SUBJECT (violation) or through the LENS OF THIS CHAPTER (acceptable)? Documenting empirical patterns/observations of X within this chapter's context is NOT the same as teaching X's theory (e.g., documenting consumption's cyclical behavior is a business cycle fact, not consumption theory)
  - When a lesson's title mentions a neighboring topic, read the description to determine focus. A lesson titled "Cortiços as disease ecologies" focused on disease transmission is health content, not urbanization content

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
      - Should break down each protocol and networking concept individually (IP, TCP, UDP, NAT as separate lessons)
      - Should cover different types of failure modes as distinct lessons
      - Should separate latency concepts from bandwidth concepts
      - Should NOT create dedicated lessons teaching DNS records, resolvers, or domain configuration (neighboring chapter "DNS and domains" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching HTTP methods, status codes, or headers (neighboring chapter "HTTP" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching TLS handshakes, certificates, or HTTPS configuration (neighboring chapter "HTTPS and TLS" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-web-networking-fundamentals",
    userInput: {
      chapterDescription:
        "IP addressing, routing, NAT, TCP vs UDP, latency and bandwidth tradeoffs, and common failure modes. Practical mental models for debugging connectivity issues.",
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Roles, responsibilities, and interfaces across front-end, back-end, full-stack, QA, DevOps, security, design, and product. How standards bodies and browser vendors shape the platform.",
          title: "Web development landscape",
        },
        {
          description:
            "DNS records, resolvers, caching, propagation, and common configurations for web apps. Domain strategy, subdomains, and pitfalls with split-horizon DNS.",
          title: "DNS and domains",
        },
        {
          description:
            "HTTP methods, status codes, headers, content negotiation, caching semantics, cookies, and redirects. HTTP/2 and HTTP/3 concepts and performance implications.",
          title: "HTTP",
        },
        {
          description:
            "TLS handshakes, certificate chains, HSTS, OCSP stapling, and modern TLS configuration choices. Secure transport patterns for browsers, APIs, and internal services.",
          title: "HTTPS and TLS",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down each numeric type into separate lessons (int, float, complex, bool, None)
      - Should cover precision and rounding as individual concepts
      - Should separate type conversions from arithmetic operations
      - Operations and methods on numeric types (e.g., bitwise ops on int, cmath functions for complex, Decimal/Fraction methods) ARE within scope — these are behaviors of the numeric types themselves. Only penalize if a lesson's primary focus is a data structure or I/O concept that merely uses numbers as an example
      - Should NOT create dedicated lessons teaching installation, virtual environments, or IDE setup (neighboring chapter "Ambiente de desenvolvimento" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching indentation rules, naming conventions, or docstrings (neighboring chapter "Sintaxe e convenções" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching strings, bytes, or Unicode encoding (neighboring chapter "Texto e codificação" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching lists, tuples, dictionaries, or sets (neighboring chapter "Estruturas de dados fundamentais" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-tipos-numericos",
    userInput: {
      chapterDescription:
        "Inteiros, floats, complexos, bool, None; conversões, precisão numérica, erros de arredondamento e uso de decimal/fractions.",
      chapterTitle: "Tipos numéricos e valores especiais",
      courseTitle: "Python",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Instalação e configuração do Python, múltiplas versões, PATH, virtual environments, VS Code/IDEs, REPL, Jupyter e boas práticas de organização local.",
          title: "Ambiente de desenvolvimento",
        },
        {
          description:
            "Execução em REPL, scripts e módulos; shebang, codificação, argumentos de linha de comando e status de saída do processo.",
          title: "Execução de programas",
        },
        {
          description:
            "Regras de indentação, nomes, comentários, docstrings, literais, operadores e precedência; diferenças entre Python interativo e arquivo.",
          title: "Sintaxe e convenções",
        },
        {
          description:
            "Strings, bytes e bytearray; Unicode, normalização, encodings, f-strings, formatação avançada e manipulação eficiente.",
          title: "Texto e codificação",
        },
        {
          description:
            "Listas, tuplas, dicionários e conjuntos; mutabilidade, cópia rasa vs profunda, hashing, ordenação e complexidade de operações.",
          title: "Estruturas de dados fundamentais",
        },
        {
          description:
            "if/elif/else, match/case, loops, break/continue, compreensão de escopo e padrões comuns de controle.",
          title: "Controle de fluxo",
        },
      ],
    },
  },
  // Mid-course chapters
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should separate nucleophilic addition to carbonyls from enolate chemistry
      - Should break down each named reaction (Aldol, Claisen, Michael) as individual lessons
      - Should cover selectivity control concepts as distinct lessons
      - Should NOT create dedicated lessons teaching SN1/SN2 or elimination reactions (neighboring chapter "Sustitución y eliminación" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching additions to alkenes or alkynes (neighboring chapter "Adiciones a alquenos y alquinos" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching aromatic chemistry or electrophilic aromatic substitution (neighboring chapter "Química aromática" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching general carboxylic acid derivative reactivity or acyl substitution chemistry (neighboring chapter "Ácidos carboxílicos y derivados" covers that) — brief contextual references are fine. IMPORTANT: The Claisen condensation and Dieckmann cyclization ARE explicitly within this chapter's scope (listed in the chapter description as enolate reactions). Do NOT penalize lessons on Claisen/Dieckmann mechanism, enolate-of-ester formation, or related selectivity — these are enolate chemistry, not acyl substitution

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-carbonilos-enolatos",
    userInput: {
      chapterDescription:
        "Adición nucleofílica a carbonilos, química de enoles/enolatos, aldol, Claisen, Michael y control de selectividad.",
      chapterTitle: "Carbonilos y enolatos",
      courseTitle: "Química",
      language: "es",
      neighboringChapters: [
        {
          description:
            "SN1/SN2, E1/E2, reactividad, solventes, nucleófilos/bases, rearrangements y control de selectividad.",
          title: "Sustitución y eliminación",
        },
        {
          description:
            "Hidrogenación, halogenación, hidratación, hidroboración-oxidación, adiciones conjugadas y química de alquinos.",
          title: "Adiciones a alquenos y alquinos",
        },
        {
          description:
            "Aromaticidad, sustitución electrofílica/nucleofílica aromática, directores, y reactividad de sistemas aromáticos extendidos.",
          title: "Química aromática",
        },
        {
          description:
            "Reactividad de ácidos carboxílicos, derivados acílicos, química de amidas/ésteres/anhídridos y estrategias de activación.",
          title: "Ácidos carboxílicos y derivados",
        },
        {
          description:
            "Síntesis y reactividad de heterociclos aromáticos y saturados; aplicaciones en fármacos y materiales.",
          title: "Heterociclos",
        },
        {
          description:
            "Mecanismos radicalarios, iniciación/propagación/terminación, selectividad, y reacciones fotoquímicas orgánicas.",
          title: "Radicales y fotoquímica orgánica",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should separate stylized facts from theoretical models
      - Should cover each type of comovement individually
      - Should distinguish business cycle measurement from theory
      - Should NOT create dedicated lessons teaching national income accounting or GDP measurement (neighboring chapter "Macroeconomic accounting" covers that) — brief contextual references are fine. IMPORTANT: Business cycle measurement methodology (e.g., cycle dating, leading/lagging indicators, diffusion indices) IS within scope — these are tools for identifying and characterizing business cycles, not general national accounting concepts. Only penalize if a lesson teaches GDP construction, price index methodology, or sectoral balances as its own subject
      - Should NOT create dedicated lessons teaching consumption-savings models or life-cycle theory (neighboring chapter "Consumption and savings" covers that) — brief contextual references are fine. IMPORTANT: Documenting the empirical cyclical behavior of consumption (e.g., "Consumption Comovement") IS within scope as a business cycle fact; only penalize if the lesson teaches consumption theory itself (permanent income hypothesis, life-cycle model, etc.)
      - Should NOT create dedicated lessons teaching investment theory or q-models (neighboring chapter "Investment and capital" covers that) — brief contextual references are fine. IMPORTANT: Documenting the empirical cyclical behavior of investment (e.g., "Investment Comovement") IS within scope as a business cycle fact; only penalize if the lesson teaches investment theory itself (q-models, adjustment costs, etc.)
      - Should NOT create dedicated lessons teaching labor market search models or wage setting (neighboring chapter "Unemployment and labor in macro" covers that) — brief contextual references are fine. IMPORTANT: Documenting the empirical cyclical behavior of unemployment/employment IS within scope as a business cycle fact; only penalize if the lesson teaches labor market theory itself (search and matching, wage bargaining, etc.)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-business-cycles",
    userInput: {
      chapterDescription:
        "Business cycle facts, stylized patterns in output, inflation, unemployment, productivity, and comovements across sectors.",
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Behavioral biases, bounded rationality, time inconsistency, social preferences, and policy design with behavioral responses.",
          title: "Behavioral economics",
        },
        {
          description:
            "Laboratory and field experiments, incentive design, external validity, and behavioral/market design evidence.",
          title: "Experimental economics",
        },
        {
          description:
            "National income and product accounts, sectoral balances, price indices, productivity, and flow-of-funds concepts.",
          title: "Macroeconomic accounting",
        },
        {
          description:
            "Consumption-saving, life-cycle and permanent income models, liquidity constraints, and empirical puzzles.",
          title: "Consumption and savings",
        },
        {
          description:
            "Investment theory, q-models, adjustment costs, irreversibility, and firm-level investment dynamics.",
          title: "Investment and capital",
        },
        {
          description:
            "Labor markets in macro, search and matching, wage setting, unemployment dynamics, and Beveridge curve analysis.",
          title: "Unemployment and labor in macro",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down architectural concepts individually (modularity, coupling, cohesion as separate lessons)
      - Should cover fitness functions as distinct lessons
      - Should separate evolutionary architecture theory from practical decision-making
      - Should NOT create dedicated lessons teaching DevOps pipelines, CI/CD, or infrastructure as code (neighboring chapter "DevOps e entrega contínua" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching SLIs, SLOs, or error budgets (neighboring chapter "SRE e confiabilidade em produtos digitais" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching technical debt management or strategic refactoring (neighboring chapter "Dívida técnica e sustentabilidade" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching test strategies, test pyramids, or automated testing (neighboring chapter "Estratégias modernas de testes" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-arquitetura-agil",
    userInput: {
      chapterDescription:
        "Arquitetura evolutiva, modularidade, acoplamento/cohesão, fitness functions e decisões arquiteturais compatíveis com mudanças frequentes.",
      chapterTitle: "Arquitetura em ambientes ágeis",
      courseTitle: "Metodologias Ágeis",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Dual Track (Discovery/Delivery), discovery contínuo, e prevenção de 'teatro ágil' com entrega sem aprendizado.",
          title: "Discovery e Delivery integrados",
        },
        {
          description:
            "DevOps: colaboração Dev+Ops, automação, pipelines, IaC, e redução de handoffs para acelerar e estabilizar entregas.",
          title: "DevOps e entrega contínua",
        },
        {
          description:
            "SRE: SLIs/SLOs, error budget, confiabilidade como requisito, e equilíbrio entre velocidade e estabilidade.",
          title: "SRE e confiabilidade em produtos digitais",
        },
        {
          description:
            "Gestão de dívida técnica, qualidade interna, refatoração estratégica, e mecanismos de priorização junto ao valor de negócio.",
          title: "Dívida técnica e sustentabilidade",
        },
        {
          description:
            "Qualidade e testes: pirâmide de testes, testes automatizados, testes exploratórios, e estratégias para sistemas distribuídos.",
          title: "Estratégias modernas de testes",
        },
        {
          description:
            "Segurança no ciclo ágil: threat modeling, DevSecOps, shift-left, gestão de vulnerabilidades e resposta a incidentes.",
          title: "Segurança e DevSecOps",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should cover each Horcrux-related concept separately
      - Should distinguish between alchemy, the Philosopher's Stone, and Horcrux concepts
      - Should break down moral and philosophical implications of soul fragmentation individually
      - Even though this is pop culture, lessons should still be focused and granular
      - Should NOT create dedicated lessons teaching Legilimency, Occlumency, or memory manipulation (neighboring chapter "Mind magic and memory" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching wand woods, cores, or the Elder Wand (neighboring chapter "Wandlore" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching magical healing or St Mungo's (neighboring chapter "Healing and magical medicine" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching divination methods or prophecy (neighboring chapter "Divination and prophecy" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-harry-potter-alchemy-horcruxes",
    userInput: {
      chapterDescription:
        "Alchemy, immortality myths, and the Philosopher's Stone as symbol. Horcrux metaphysics and the costs of soul fragmentation.",
      chapterTitle: "Alchemy, Horcruxes, and immortality",
      courseTitle: "Harry Potter",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Defense curriculum across eras and how teaching reflects politics. Practical spell selection, threat models, and the pedagogy of fear.",
          title: "Defense Against the Dark Arts",
        },
        {
          description:
            "Divination's ambiguity, self-fulfilling prophecy, and narrative foreshadowing. Symbol systems: tea leaves, dreams, centaurs, and astronomy.",
          title: "Divination and prophecy",
        },
        {
          description:
            "Mind magic: Legilimency, Occlumency, memory charms, and Pensieve ethics. Consent, epistemology, and the reliability of recollection.",
          title: "Mind magic and memory",
        },
        {
          description:
            "Wand woods, cores, allegiance, and the Elder Wand's legend. Comparative magical foci and what wandlore implies about power and identity.",
          title: "Wandlore",
        },
        {
          description:
            "Magical healing, St Mungo's, and the boundaries of restorative magic. Disability, trauma, and long-term consequences in the series.",
          title: "Healing and magical medicine",
        },
        {
          description:
            "Werewolves, vampires, giants, goblins, house-elves, centaurs, and merpeople as political subjects. Rights, stereotypes, and allegory across species.",
          title: "Beings, creatures, and species politics",
        },
      ],
    },
  },
  // Late/final chapters
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down each legal tech concept individually (templates, document review, version control)
      - Should cover automation risks and governance as distinct lessons
      - Should separate document management from quality standardization
      - Should NOT create dedicated lessons teaching litigation strategy or dispute portfolio management (neighboring chapter "Estratégia contenciosa e gestão de disputas" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching legal operations management, SLAs, or KPIs (neighboring chapter "Legal operations e gestão jurídica" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching contract lifecycle management or CLM (neighboring chapter "Operações contratuais" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching negotiation techniques, BATNA, or ZOPA (neighboring chapter "Negociação estratégica" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-legal-tech",
    userInput: {
      chapterDescription:
        "Automação jurídica e qualidade: templates, revisão assistida, gestão documental e padronização. Riscos de automação, controle de versões e governança de conhecimento.",
      chapterTitle: "Legal tech e automação de documentos",
      courseTitle: "Direito",
      language: "pt",
      neighboringChapters: [
        {
          description:
            "Programas de integridade em terceiros: due diligence, cláusulas anticorrupção e monitoramento. Gestão de contratos, auditoria e encerramento por inadimplemento de compliance.",
          title: "Gestão de terceiros e due diligence",
        },
        {
          description:
            "Estratégia de litígio: seleção de teses, definição de foro, gestão de portfólio e negociação de acordos. Monitoramento de precedentes, risco financeiro e comunicação com stakeholders.",
          title: "Estratégia contenciosa e gestão de disputas",
        },
        {
          description:
            "Gestão de escritórios e departamentos jurídicos: triagem, SLAs, indicadores e orçamento. Precificação, honorários, contratação de correspondentes e qualidade.",
          title: "Legal operations e gestão jurídica",
        },
        {
          description:
            "Gestão de contratos: ciclo de vida, cláusulas padrão, aprovações e controle de obrigações. CLM, auditoria contratual e prevenção de disputas.",
          title: "Operações contratuais",
        },
        {
          description:
            "Negociação e mediação avançadas: BATNA, ZOPA, técnicas de influência e gestão de impasses. Construção de acordos complexos e multiparte.",
          title: "Negociação estratégica",
        },
        {
          description:
            "Oratória e atuação em audiência: teoria do caso, exame e contrainterrogatório, sustentação oral e postura profissional. Comunicação com juízes, jurados e peritos.",
          title: "Advocacia oral e persuasão",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should break down each historical period's health challenges into separate lessons
      - Should cover epidemics, sanitation campaigns, and health systems individually
      - Should separate public health policy from biomedical politics
      - Should NOT create dedicated lessons teaching urbanization, housing policy, or favela politics/governance (neighboring chapter "Cities and urban inequality" covers that) — brief contextual references are fine. IMPORTANT: Lessons about health outcomes and disease transmission mechanisms IN urban settings (e.g., overcrowding as disease vector, sanitation infrastructure gaps) ARE within scope when the focus is on health/epidemiology. Only penalize lessons primarily about urban form, housing policy, or settlement patterns rather than health mechanisms
      - Should NOT create dedicated lessons teaching environmental history, deforestation, or the Amazon (neighboring chapter "Environmental history and the Amazon" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching military history, coups, or defense policy (neighboring chapter "Military and national security" covers that) — brief contextual references are fine
      - Should NOT create dedicated lessons teaching historiography, monuments, or public memory (neighboring chapter "Historiography and public memory" covers that) — brief contextual references are fine

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-health-disease",
    userInput: {
      chapterDescription:
        "Public health, epidemics, health systems, and biomedical politics from the 19th century to COVID-19; sanitation campaigns and inequality.",
      chapterTitle: "Health and disease",
      courseTitle: "Brazilian History",
      language: "en",
      neighboringChapters: [
        {
          description:
            "Football history, race and class in sport, club cultures, mega-events, and stadium politics; sport as national narrative.",
          title: "Sports and society",
        },
        {
          description:
            "Urbanization, housing, sanitation, policing, and informal settlements; favelas, segregation, and metropolitan governance.",
          title: "Cities and urban inequality",
        },
        {
          description:
            "Amazon, Cerrado, and Atlantic Forest histories: extraction, conservation, Indigenous stewardship, climate politics, and environmental governance.",
          title: "Environmental history and the Amazon",
        },
        {
          description:
            "Professionalization of the armed forces, coups, doctrine, and defense policy; civil-military relations in democracy.",
          title: "Military and national security",
        },
        {
          description:
            "Diplomacy from empire to present: borders, regional leadership, multilateralism, South–South ties, and great-power relations.",
          title: "Foreign policy and international relations",
        },
        {
          description:
            "How Brazil's past is narrated and contested: schools, monuments, museums, reparations debates, transitional justice, and public history.",
          title: "Historiography and public memory",
        },
      ],
    },
  },
];
