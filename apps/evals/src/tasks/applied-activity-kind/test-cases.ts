const SHARED_EXPECTATIONS = `
  This is a binary classification task. The output is a single label: "story" or "investigation". Nothing else.

  SCORING: If the label matches the expectations below, score 10. If it does not, score 6. There is no middle ground — the classification is either correct or wrong. Do NOT reduce scores for output format, lack of reasoning, or any other factor. Only the label matters.

  CONTEXT FOR EVALUATING THE LABEL:
  - STORY = DECIDE: The learner makes decisions governed by the concepts. Best for trade-offs, cause-and-effect, resource allocation, ethics, policy choices, risk management, strategic planning.
  - INVESTIGATION = DIAGNOSE: The learner diagnoses a problem using the concepts. Best for root-cause analysis, evidence gathering, debugging, differential diagnosis, auditing, forensic analysis, scientific reasoning.
  - DIVERSITY IS A SOFT TIEBREAKER: If recentAppliedKinds is provided, it should only influence genuinely ambiguous cases. It must never override clear suitability.
`;

export const TEST_CASES = [
  // === CLEAR STORY ===

  {
    expectations: `
      MUST return "story". Vaccination conflict involves real trade-offs: a public health official deciding how aggressively to mandate vaccination, balancing coercion vs trust vs outbreak control.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-story-vaccination-conflict",
    userInput: {
      chapterTitle: "Health and disease",
      concepts: [
        "Compulsory Vaccination",
        "Vaccine Resistance",
        "The Vaccine Revolt",
        "Public Health Coercion",
        "Popular Distrust of Authorities",
      ],
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Conflicts around state-mandated prevention measures and the social meaning of bodily intervention. The lesson centers on political resistance to vaccination and public health enforcement.",
      lessonTitle: "Vaccination Conflict and State Power",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      MUST return "story". A synthetic chemist choosing reaction conditions — temperature, base strength, reversibility — where the concepts directly govern which product forms and which is wasted.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-story-control-enolatos",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      concepts: [
        "Enolato cinético",
        "Enolato termodinámico",
        "Base fuerte no nucleofílica",
        "Temperatura baja en control cinético",
        "Equilibración en control termodinámico",
        "Selectividad de desprotonación alfa",
      ],
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "La formación selectiva de enolatos depende de la reversibilidad, la temperatura, el impedimento estérico y la fuerza de la base.",
      lessonTitle: "Control cinético y termodinámico de enolatos",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      MUST return "story". A tech lead must choose which quality attributes to prioritize when they conflict — the fitness function framework governs whether the architecture stays healthy. Pure trade-off decision-making.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-story-fitness-qualidade",
    userInput: {
      chapterTitle: "Arquitetura em ambientes ágeis",
      concepts: [
        "Fitness function de desempenho",
        "Fitness function de escalabilidade",
        "Fitness function de resiliência arquitetural",
        "Fitness function de disponibilidade",
        "Fitness function de custo operacional",
        "Trade-off entre atributos de qualidade",
      ],
      courseTitle: "Metodologias Ágeis",
      language: "pt",
      lessonDescription:
        "Avaliação de características não funcionais que influenciam decisões de arquitetura em contextos de mudança. Esses critérios ajudam a comparar alternativas quando não é possível maximizar tudo ao mesmo tempo.",
      lessonTitle: "Fitness functions de atributos de qualidade",
      recentAppliedKinds: [],
    },
  },

  // === CLEAR INVESTIGATION ===

  {
    expectations: `
      MUST return "investigation". A sysadmin systematically isolating where a network path breaks — choosing which probe to run, interpreting ambiguous results, narrowing the failure domain. Pure diagnostic reasoning.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-investigation-debugging-mental-models",
    userInput: {
      chapterTitle: "Networking fundamentals",
      concepts: [
        "Layered Debugging",
        "Problem Scope",
        "Last Known Good Hop",
        "Source-Side Isolation",
        "Destination-Side Isolation",
        "One Change at a Time",
        "Symptom Reproduction",
      ],
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Mental models for narrowing down network problems systematically instead of guessing. The focus is on isolating failure domains and interpreting observations in the right order.",
      lessonTitle: "Debugging Mental Models",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      MUST return "investigation". A developer debugging a financial calculation that produces wrong totals — must identify which float operations introduced rounding errors and determine the root cause.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-investigation-erros-float",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      concepts: [
        "Arredondamento em ponto flutuante",
        "Cancelamento catastrófico",
        "Perda de significância",
        "Comparação exata entre floats",
        "math.isclose()",
        "Tolerância relativa",
        "Tolerância absoluta",
      ],
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Os principais efeitos numéricos causados por floats e as técnicas básicas para comparar resultados aproximados com segurança.",
      lessonTitle: "Erros numéricos com floats",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      MUST return "investigation". An epidemiologist examining outbreak data, mortality records, and transmission patterns to identify which disease is spreading and through which vector. The concepts govern what evidence to look for and how to interpret ambiguous symptoms across diseases.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-investigation-epidemic-patterns",
    userInput: {
      chapterTitle: "Health and disease",
      concepts: [
        "Yellow Fever in Brazil",
        "Smallpox in Brazil",
        "Cholera in Brazil",
        "Tuberculosis in Brazil",
        "Influenza in Brazil",
        "Epidemic Mortality",
        "Endemic Disease",
      ],
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Major epidemic and persistent diseases that shaped Brazilian society from the nineteenth century onward. These concepts establish the main disease patterns that public authorities and medical institutions confronted.",
      lessonTitle: "Major Diseases and Epidemic Patterns",
      recentAppliedKinds: [],
    },
  },

  // === AMBIGUOUS (either story or investigation is acceptable) ===

  {
    expectations: `
      SHOULD return "story" or "investigation" — either is defensible.
      - Investigation angle: a developer debugging a program that outputs 8 instead of 10 because the code says 0o10 (octal). Recognizing literal prefixes governs whether you can diagnose the root cause.
      - Story angle: a developer choosing between binary, hex, and decimal literals for readability in different contexts (bitmasks, colors, counts).

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ambiguous-literais-numericos",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      concepts: [
        "Literais inteiros decimais",
        "Literais inteiros binários",
        "Literais inteiros octais",
        "Literais inteiros hexadecimais",
        "Separador visual em literais numéricos",
        "Notação científica em float",
      ],
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "As formas de escrever números diretamente no código, incluindo diferentes bases para inteiros e a escrita compacta de floats muito grandes ou muito pequenos.",
      lessonTitle: "Literais numéricos",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      SHOULD return "story" or "investigation" — either is defensible.
      - Story angle: a central banker deciding when to tighten or ease policy — reading the cycle phase governs whether the intervention helps or hurts.
      - Investigation angle: an economist analyzing ambiguous real-time data (GDP slowing but employment strong) to determine which phase the economy is in — diagnostic reasoning about the current state.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ambiguous-business-cycle-phases",
    userInput: {
      chapterTitle: "Business cycles",
      concepts: [
        "Business Cycle",
        "Expansion Phase",
        "Peak of a Cycle",
        "Contraction Phase",
        "Trough of a Cycle",
        "Recession",
        "Recovery",
      ],
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "The recurring rise and fall of aggregate economic activity, with the standard turning points and phase labels used to describe fluctuations over time.",
      lessonTitle: "Business Cycle Phases",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      SHOULD return "story" or "investigation" — either is defensible.
      - Investigation angle: a legal ops manager auditing automated contracts that produced errors — tracing which template logic failed, evaluating evidence, determining root cause.
      - Story angle: a legal ops manager deciding what safeguards to build for a new automation system — which review checkpoints to add, how to limit scope, how to handle template updates. The risk concepts govern which protective measures to prioritize.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ambiguous-riscos-automacao",
    userInput: {
      chapterTitle: "Legal tech e automação de documentos",
      concepts: [
        "Obsolescência normativa",
        "Desvio de padronização",
        "Automação de erro",
        "Dependência excessiva do template",
        "Falsa sensação de conformidade",
        "Uso indevido fora do escopo",
      ],
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Riscos específicos da automação jurídica quando modelos passam a ser aplicados sem revisão de contexto, atualização ou limites claros de uso.",
      lessonTitle: "Riscos da automação documental",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      SHOULD return "story" or "investigation" — either is defensible.
      - Investigation angle: an economist at NBER analyzing ambiguous indicators to determine if a recession has started and where the turning point is — diagnostic reasoning from noisy data.
      - Story angle: an analyst deciding which cycle definition (classical vs growth cycle) to apply when advising a client — the choice of framework governs the recommendation.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ambiguous-dating-measuring-cycles",
    userInput: {
      chapterTitle: "Business cycles",
      concepts: [
        "Turning Point Dating",
        "Peak-to-Trough Decline",
        "Trough-to-Peak Expansion",
        "Diffusion Index",
        "Reference Cycle",
        "Classical Cycle",
        "Growth Cycle",
      ],
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "The main ways economists identify and compare cyclical episodes, including alternative definitions based on levels or deviations from trend.",
      lessonTitle: "Dating and Measuring Cycles",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      SHOULD return "story" or "investigation" — either is defensible.
      - Story angle: an architect choosing which decomposition strategy to adopt for a new system (trade-off decisions between monolith, microservices, components).
      - Investigation angle: analyzing an existing system to determine why changes propagate unexpectedly (diagnosis of coupling issues).

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ambiguous-decomposicao-arquitetural",
    userInput: {
      chapterTitle: "Arquitetura em ambientes ágeis",
      concepts: [
        "Arquitetura monolítica modular",
        "Microsserviço",
        "Componente implantável",
        "Granularidade de serviço",
        "Fronteira de serviço",
        "Custo de distribuição",
      ],
      courseTitle: "Metodologias Ágeis",
      language: "pt",
      lessonDescription:
        "Opções de decomposição estrutural voltadas à adaptabilidade e ao ritmo de mudança. A escolha da granularidade influencia autonomia, complexidade e esforço de evolução.",
      lessonTitle: "Escolhas de decomposição arquitetural",
      recentAppliedKinds: [],
    },
  },
  {
    expectations: `
      SHOULD return "story" or "investigation" — either is defensible.
      - Story angle: a health minister deciding how to structure the universal system (policy trade-offs between centralization vs decentralization, professional vs community care).
      - Investigation angle: analyzing outcomes of different SUS principles to determine what went wrong in a failing municipality.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ambiguous-sus-governance",
    userInput: {
      chapterTitle: "Health and disease",
      concepts: [
        "Decentralization in SUS",
        "Municipal Health Management",
        "Primary Health Care",
        "Family Health Strategy",
        "Community Health Workers",
        "Health Councils",
        "Social Participation in Health",
      ],
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Operational pillars of the Unified Health System, especially local management and community-based care. These concepts show how universal health policy works through territorial administration and participatory governance.",
      lessonTitle: "SUS Governance and Primary Care",
      recentAppliedKinds: [],
    },
  },

  // === DIVERSITY TIEBREAKER ===

  {
    expectations: `
      The topic is ambiguous — NAT behavior could work as story (a network engineer configuring NAT for a new office, making trade-off decisions) or investigation (diagnosing why inbound connections fail by tracing NAT mappings).

      With recentAppliedKinds showing ["story", "story"], the model SHOULD lean toward "investigation" as a tiebreaker.

      SCORING OVERRIDE: "investigation" = 10 (used diversity signal correctly). "story" = 8 (valid label but ignored the diversity tiebreaker on an ambiguous topic).

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-diversity-nat-after-stories",
    userInput: {
      chapterTitle: "Networking fundamentals",
      concepts: [
        "Network Address Translation",
        "Source NAT",
        "Destination NAT",
        "Port Address Translation",
        "NAT Mapping",
        "Ephemeral Port",
        "Inbound Connection Limits",
        "Carrier-Grade NAT",
      ],
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "How NAT rewrites addresses and ports to make private networks reach external networks. The lesson also covers the practical limits NAT introduces for inbound reachability.",
      lessonTitle: "NAT Behavior",
      recentAppliedKinds: ["story", "story"],
    },
  },
  {
    expectations: `
      The topic clearly fits "investigation" — a sysadmin observing "timeout" vs "connection refused" vs "no route to host" and diagnosing which network layer failed. The concepts ARE diagnostic categories.

      Even though recentAppliedKinds shows ["investigation", "investigation"], the model MUST still return "investigation" because the topic's fit is unmistakable. Diversity must not override suitability.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-diversity-failure-modes-despite-investigations",
    userInput: {
      chapterTitle: "Networking fundamentals",
      concepts: [
        "No Route to Host",
        "Timeout",
        "Connection Refused",
        "Packet Loss Symptoms",
        "Intermittent Connectivity",
        "MTU Black Hole",
        "Port Exhaustion",
      ],
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Common network failure patterns and the distinct symptoms they create at the application or socket level. Recognizing these patterns speeds up diagnosis before deeper investigation.",
      lessonTitle: "Common Network Failure Modes",
      recentAppliedKinds: ["investigation", "investigation"],
    },
  },
];
