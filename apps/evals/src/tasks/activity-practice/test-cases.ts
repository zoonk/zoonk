const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. PRACTICE AUTHENTICITY: Dialogue must be pure conversation between colleagues with no narrator text, no character name prefixes (like "Sarah:"), and no action descriptions. The learner should feel immersed in a real workplace conversation.

2. EDUCATIONAL ALIGNMENT: Every decision point must require applying lesson concepts through reasoning, not memorizing facts. Wrong options should be plausible but flawed for specific conceptual reasons. Penalize meta-scenarios where the main action is preparing a presentation, poster, cartaz, slogan, summary, or wording about the lesson topic instead of using the concept in a real situation.

3. PLOT COHERENCE: Steps must flow naturally as a continuous practice where each step builds from the previous dialogue. Near the end (within the final 2-3 steps), the practice should introduce a fun, surprising twist that reframes the narrative — the best twists subvert an assumption the practice has been building. A mere escalation or a new requirement from a teacher, boss, or client is not enough to count as a twist. Strong twists usually reinterpret earlier details rather than just adding a late surprise. The final step must resolve the problem AND reinforce the main learning takeaway. Do NOT penalize for exact twist placement (e.g., 2nd-to-last vs 3rd-to-last) as long as the narrative flow is good.

4. FORMAT COMPLIANCE: Verify these constraints:
   - context: Maximum 500 characters of pure dialogue
   - question: Maximum 100 characters
   - options: Exactly 4 objects, each with: text (max 50 chars, allow up to 55 without penalty), isCorrect (boolean), feedback (max 300 chars)
   - Exactly 1 option must have isCorrect: true, the other 3 must have isCorrect: false
   - Do NOT penalize for output being wrapped in {"steps": [...]} vs a raw array — both are valid formats

5. PERSONALIZATION: The {{NAME}} placeholder must be used appropriately in dialogue to personalize the experience.

6. FEEDBACK QUALITY: Each option must have feedback explaining WHY it's right (with insight) or WHY it's wrong (and what would be correct). Feedback should help learners understand the reasoning, not just state correctness.

7. STEP COUNT: Practice must have between 7 and 20 steps. Let problem complexity dictate length.

8. DISTRACTOR QUALITY: All wrong options must be plausible choices someone might consider. Do not penalize light humor, playful wording, or a mildly funny option if it is still believable in the scene. Penalize distractors that are so silly or absurd that no reasonable person would choose them.

9. DIALOGUE NATURALNESS: Penalize dialogue that sounds like prompt residue, coaching language, polished writing advice, or translated corporate speech instead of something a real person in the scene would say. This includes lines that comment on how a question or sentence sounds rather than moving the scene forward. Examples of suspicious phrasing include things like "great question", "honestly", "without sounding rehearsed", "How do I say that without sounding awkward?", "What wording works better?", or local-language equivalents of that same delivery-focused wording when they feel copied from instructions rather than motivated by the scene. Also penalize dialogue that announces the story structure with labels like "twist", "plot twist", "big reveal", or local-language equivalents instead of letting the surprise happen naturally. Do not penalize light humor, playful exchanges, or a mildly silly twist when they still feel natural for the scene.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific plot choices, character names, or scenario settings you might expect
- Do NOT require specific steps like "investigation" or "resolution" by name - focus on whether the practice has good flow
- Do NOT check against an imagined "ideal" practice structure
- Do NOT penalize for exact twist placement — if the twist occurs anywhere in the final third of the story, that's fine
- Do NOT penalize for output being wrapped in {"steps": [...]} instead of a raw array
- Do NOT penalize option text that is 55 characters or fewer — only penalize options clearly exceeding 55 characters
- Do NOT penalize light humor, a playful tone, or slightly silly moments when they still sound natural and scene-appropriate
- Do penalize scenes whose main task is choosing wording, polishing phrasing, or presenting the concept instead of using it
- Do penalize lines that feel like prompt instructions leaking into dialogue, even if grammar and structure are otherwise correct
- ONLY penalize for: format violations (option text over 55 chars, context over 500 chars, etc.), narrator/description text in dialogue, decisions that test memorization instead of reasoning, complete absence of any twist or surprise, poor distractor quality, or factually incorrect lesson application
- Different valid practice approaches exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Network data movement decisions must reflect genuine networking concepts. Penalize if:
   - Encapsulation layers are confused or misordered
   - Forwarding decisions are described as centralized rather than hop-by-hop

2. SCENARIO CHECK: The workplace problem should involve realistic networking challenges like: debugging connectivity issues, optimizing data transfer, diagnosing packet loss, or designing network architectures.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about how data encapsulation and forwarding constraints affect network behavior.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-data-movement",
    userInput: {
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      explanationSteps: [
        {
          text: "Data is wrapped in headers at each network layer (application, transport, network, link) before transmission, with each layer adding its own control information.",
          title: "Encapsulation",
        },
        {
          text: "Each router makes independent forwarding decisions based on its own routing table, passing packets one hop at a time toward the destination.",
          title: "Hop-by-Hop Forwarding",
        },
        {
          text: "The maximum size of a single frame that can be transmitted over a network link, typically 1500 bytes for Ethernet.",
          title: "Maximum Transmission Unit",
        },
        {
          text: "When a packet exceeds the MTU of a link, it is split into smaller fragments that are reassembled at the destination.",
          title: "Packet Fragmentation",
        },
      ],
      language: "en",
      lessonDescription:
        "Core building blocks for how data moves across networks, from encapsulation to hop-by-hop forwarding constraints.",
      lessonTitle: "How Data Moves on Networks",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Python float and bool concepts must be technically accurate. Penalize if:
   - Bool-int subclass relationship is misrepresented
   - Float precision issues are incorrectly described

2. PORTUGUESE NATURALNESS CHECK: Prefer everyday Brazilian Portuguese. Penalize stiff, translated, or prompt-like phrasing that sounds written instead of spoken, including local-language versions of phrases like "without sounding rehearsed" when they do not fit the scene.

3. SCENARIO CHECK: The workplace problem should involve realistic Python programming challenges like: debugging unexpected numeric behavior, handling precision in financial calculations, or resolving type coercion surprises.

4. CONCEPTUAL FOCUS: Decisions should require reasoning about the structural relationship between bool and int, and about float precision limitations.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-float-bool",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      courseTitle: "Python",
      explanationSteps: [
        {
          text: "Números de ponto flutuante usam representação IEEE 754, o que pode causar imprecisões em cálculos decimais como 0.1 + 0.2 != 0.3.",
          title: "Ponto Flutuante",
        },
        {
          text: "Em Python, bool é uma subclasse de int, onde True == 1 e False == 0, permitindo operações aritméticas com booleanos.",
          title: "Booleanos como Inteiros",
        },
        {
          text: "Python suporta diferentes formas de literais numéricos: inteiros decimais, hexadecimais (0x), octais (0o), binários (0b) e notação científica para floats.",
          title: "Literais Numéricos",
        },
        {
          text: "A hierarquia de tipos numéricos em Python vai de bool → int → float → complex, com conversões implícitas seguindo essa ordem.",
          title: "Hierarquia de Tipos",
        },
      ],
      language: "pt",
      lessonDescription:
        "Valores de ponto flutuante e booleanos, sintaxe de literais e a relação estrutural entre bool e int.",
      lessonTitle: "Float e bool como tipos numéricos",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Labor market cycle concepts must reflect genuine economic dynamics. Penalize if:
   - Unemployment is described as leading rather than lagging GDP
   - Recovery dynamics are presented as symmetric to contraction

2. SCENARIO CHECK: The workplace problem should involve realistic economic analysis challenges like: interpreting labor data during a downturn, advising on workforce planning, or communicating economic indicators to stakeholders.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about the timing and relationships between different labor market indicators during cycles.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-labor-cycles",
    userInput: {
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      explanationSteps: [
        {
          text: "The percentage of the labor force that is jobless and actively seeking work; it is a lagging indicator that peaks after GDP has already started recovering.",
          title: "Unemployment Rate",
        },
        {
          text: "Total hours worked across the economy tend to drop before unemployment rises during downturns, as employers cut hours before cutting jobs.",
          title: "Hours Worked",
        },
        {
          text: "The share of the working-age population that is either employed or actively looking for work; it can decline during prolonged downturns as people exit the labor force.",
          title: "Labor Force Participation",
        },
        {
          text: "Workers who have stopped looking for employment because they believe no jobs are available; they are not counted in the official unemployment rate.",
          title: "Discouraged Workers",
        },
      ],
      language: "en",
      lessonDescription:
        "Empirical regularities linking downturns to labor market outcomes at the level of aggregate fluctuations, without modeling search or wage-setting mechanisms.",
      lessonTitle: "Labor market aggregates over the cycle",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Enolate chemistry concepts must be chemically accurate. Penalize if:
   - Enolates are treated as electrophiles rather than nucleophiles
   - α-acidity mechanisms are incorrectly described

2. SCENARIO CHECK: The workplace problem should involve realistic organic chemistry challenges like: planning a synthesis route, troubleshooting a failed aldol reaction, or choosing between enolate formation conditions.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about α-acidity, enolate stability, and nucleophilic reactivity in C–C bond formation.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-acidez-enolatos",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      courseTitle: "Química",
      explanationSteps: [
        {
          text: "Los hidrógenos en posición alfa al carbonilo son ácidos debido a la estabilización por resonancia del carbanión resultante con el grupo C=O.",
          title: "Acidez en Posición Alfa",
        },
        {
          text: "El enolato se estabiliza por deslocalización de la carga negativa entre el carbono alfa y el oxígeno del carbonilo, formando dos estructuras resonantes.",
          title: "Estabilización por Resonancia",
        },
        {
          text: "El enolato actúa como nucleófilo rico en electrones que ataca electrófilos como haluros de alquilo o carbonilos de otros compuestos.",
          title: "Enolato como Nucleófilo",
        },
        {
          text: "Reacción donde un enolato ataca el carbonilo de otra molécula, formando un β-hidroxicarbonilo que puede deshidratarse a un producto α,β-insaturado.",
          title: "Condensación Aldólica",
        },
      ],
      language: "es",
      lessonDescription:
        "Origen de la acidez en α y cómo se forma el enolato como nucleófilo clave en reacciones de construcción C–C.",
      lessonTitle: "Acidez en α y formación de enolatos",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Legal automation monitoring concepts must be technically sound. Penalize if:
   - Audit requirements are misrepresented for the legal context
   - Quality metrics are described without connection to document safety

2. PORTUGUESE NATURALNESS CHECK: Prefer everyday Brazilian Portuguese. Penalize stiff, translated, or prompt-like phrasing that sounds written instead of spoken, including lines like "foi uma otima pergunta" when they do not fit the scene.

3. SCENARIO CHECK: The workplace problem should involve realistic legal tech challenges like: investigating a batch of documents with errors, setting up monitoring for a new automation pipeline, or responding to an audit finding.

4. CONCEPTUAL FOCUS: Decisions should require reasoning about how metrics and audit trails ensure quality and safety in automated legal document generation.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-medicao-automacao",
    userInput: {
      chapterTitle: "Legal tech e automação de documentos",
      courseTitle: "Direito",
      explanationSteps: [
        {
          text: "Indicadores como taxa de erro, completude de campos e conformidade com templates que medem a qualidade dos documentos gerados automaticamente.",
          title: "Métricas de Qualidade Documental",
        },
        {
          text: "Registros detalhados de cada ação realizada pelo sistema de automação, incluindo quem iniciou, quando executou e quais alterações foram feitas.",
          title: "Rastros de Auditoria",
        },
        {
          text: "Categorização de erros em níveis de severidade (crítico, alto, médio, baixo) para priorizar correções e identificar padrões recorrentes.",
          title: "Classificação de Erros",
        },
        {
          text: "Métricas que monitoram riscos de segurança como acesso não autorizado, vazamento de dados sensíveis e integridade dos documentos gerados.",
          title: "Indicadores de Segurança",
        },
      ],
      language: "pt",
      lessonDescription:
        "Métricas operacionais focadas em qualidade e segurança da automação documental, com rastros para auditoria.",
      lessonTitle: "Medição e monitoramento da automação",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Connectivity debugging concepts must be technically accurate. Penalize if:
   - Layer isolation logic is incorrect (e.g., claiming a DNS failure means the physical link is down)
   - Debugging steps are presented in a wrong or illogical order

2. SCENARIO CHECK: The workplace problem should involve realistic networking challenges like: diagnosing why an app can't reach its database, troubleshooting a deployment that works locally but fails in production, or investigating intermittent connectivity in a distributed system.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about which network layer is likely at fault based on symptoms, and how to systematically narrow the problem.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-debugging-mental-models",
    userInput: {
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      explanationSteps: [
        {
          text: "A systematic approach to debugging connectivity by testing each network layer independently, starting from the physical/link layer up to the application layer.",
          title: "Layer-by-Layer Isolation",
        },
        {
          text: "Verifying local network settings including IP address assignment, subnet mask, DNS resolver configuration, and routing table entries.",
          title: "Host Configuration Check",
        },
        {
          text: "Testing whether the default gateway is reachable, which confirms the local network segment is functioning and the first hop router is accessible.",
          title: "Gateway Reachability",
        },
        {
          text: "Diagnosing issues at the application layer such as DNS resolution failures, TLS handshake errors, or service port connectivity problems.",
          title: "Service-Layer Diagnosis",
        },
      ],
      language: "en",
      lessonDescription:
        "Practical mental models for narrowing a problem to host, subnet, gateway, path, or service-layer reachability without relying on protocol-specific details.",
      lessonTitle: "Connectivity Debugging Mental Models",
    },
  },
];
