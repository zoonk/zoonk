const SHARED_EXPECTATIONS = `
  # How to evaluate

  You are evaluating a CURRICULUM, not a glossary. Think like a curriculum designer reviewing a colleague's work — use domain expertise and professional judgment, not mechanical rule-checking.

  ## Structure

  Output is organized into LESSON UNITS (thematic groups) containing CONCEPTS (individual teachable items).
  - Each concept should be a single, specific idea — something a domain expert would consider one teachable unit
  - Lesson sizes should be 3-8 concepts and should vary naturally across lessons
  - Total concept coverage should be exhaustive for the chapter's scope

  ## Evaluating concept quality

  Ask: "Is this ONE teachable thing, or is it secretly a bundle of separate things?"
  - A concept is too broad only if it genuinely bundles multiple DISTINCT teachable items that a student would need separate lessons for
  - Use domain expertise: terms that sound broad to a generalist may be a single well-defined concept in the field
  - Conjunctions (AND/OR/VS and equivalents in any language) signal potential broadness, but only penalize when they join genuinely separate topics — not when the comparison itself IS the concept, or when "and" connects an entity to its work
  - Concept titles should be concrete and self-explanatory, not interpretive thesis statements or vague abstractions

  ## Evaluating scope

  The chapter description is the SOURCE OF TRUTH. Neighboring chapters are guardrails against scope creep, not vetoes.

  The key principle: **judge by framing, not by keywords.** A concept belongs in THIS chapter if its primary teaching purpose serves THIS chapter's learning goals — even if the concept mentions words that appear in a neighboring chapter's title. Ask: "What is this concept primarily TEACHING?" not "Does this concept MENTION a neighboring topic?"

  When in doubt, favor the chapter description. If a concept is framed through this chapter's lens and serves its learning goals, it is in-scope.

  ## Evaluating lesson quality

  - Lesson descriptions should be concise and go straight to the content — no filler words like "introduces", "presents", "teaches", "explores"
  - Logical progression from foundational to advanced
  - No summary, review, or assessment lessons
  - Should follow the specified language (proper nouns and established technical terms may remain in their original language)

  ## Coverage

  Completeness is the key metric. Are all topics in the chapter description covered with sufficient granularity? Don't penalize for fewer concepts if the chapter's scope is inherently narrow.

  ## Proportionality

  Weight your scoring proportionally. A curriculum that covers the chapter exhaustively with good structure but has a few overly-broad concept titles is fundamentally different from one that misses entire topics or systematically violates scope. Minor title-phrasing issues should not dominate the score when the overall curriculum quality is strong.
`;

export const TEST_CASES = [
  // Initial chapters (beginning of courses)
  {
    expectations: `
      - MUST be in US English

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
      - Even though this is pop culture, concepts should still be focused and granular

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
      - MUST be in US English (proper nouns of Brazilian institutions remain in Portuguese)

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
