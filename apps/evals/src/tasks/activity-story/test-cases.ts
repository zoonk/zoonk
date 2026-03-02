const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. STORY AUTHENTICITY: Dialogue must be pure conversation between colleagues with no narrator text, no character name prefixes (like "Sarah:"), and no action descriptions. The learner should feel immersed in a real workplace conversation.

2. EDUCATIONAL ALIGNMENT: Every decision point must require applying lesson concepts through reasoning, not memorizing facts. Wrong options should be plausible but flawed for specific conceptual reasons.

3. PLOT COHERENCE: Steps must flow naturally as a continuous story where each step builds from the previous dialogue. Near the end (within the final 2-3 steps), the story should introduce a fun, surprising twist that reframes the narrative — the best twists subvert an assumption the story has been building. The final step must resolve the problem AND reinforce the main learning takeaway. Do NOT penalize for exact twist placement (e.g., 2nd-to-last vs 3rd-to-last) as long as the narrative flow is good.

4. FORMAT COMPLIANCE: Verify these constraints:
   - context: Maximum 500 characters of pure dialogue
   - question: Maximum 100 characters
   - options: Exactly 4 objects, each with: text (max 50 chars, allow up to 55 without penalty), isCorrect (boolean), feedback (max 300 chars)
   - Exactly 1 option must have isCorrect: true, the other 3 must have isCorrect: false
   - Do NOT penalize for output being wrapped in {"steps": [...]} vs a raw array — both are valid formats

5. PERSONALIZATION: The {{NAME}} placeholder must be used appropriately in dialogue to personalize the experience.

6. FEEDBACK QUALITY: Each option must have feedback explaining WHY it's right (with insight) or WHY it's wrong (and what would be correct). Feedback should help learners understand the reasoning, not just state correctness.

7. STEP COUNT: Story must have between 7 and 20 steps. Let problem complexity dictate length.

8. DISTRACTOR QUALITY: All wrong options must be plausible choices someone might consider. Penalize obviously silly or absurd options that no reasonable person would choose.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific plot choices, character names, or scenario settings you might expect
- Do NOT require specific steps like "investigation" or "resolution" by name - focus on whether the story has good flow
- Do NOT check against an imagined "ideal" story structure
- Do NOT penalize for exact twist placement — if the twist occurs anywhere in the final third of the story, that's fine
- Do NOT penalize for output being wrapped in {"steps": [...]} instead of a raw array
- Do NOT penalize option text that is 55 characters or fewer — only penalize options clearly exceeding 55 characters
- ONLY penalize for: format violations (option text over 55 chars, context over 500 chars, etc.), narrator/description text in dialogue, decisions that test memorization instead of reasoning, complete absence of any twist or surprise, poor distractor quality, or factually incorrect lesson application
- Different valid story approaches exist - assess the quality of what IS provided
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
      concepts: [
        "Encapsulation",
        "Hop-by-Hop Forwarding",
        "Maximum Transmission Unit",
        "Packet Fragmentation",
      ],
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Core building blocks for how data moves across networks, from encapsulation to hop-by-hop forwarding constraints.",
      lessonTitle: "How Data Moves on Networks",
      neighboringConcepts: ["DNS Resolution", "TCP Handshake", "Socket Programming"],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Python float and bool concepts must be technically accurate. Penalize if:
   - Bool-int subclass relationship is misrepresented
   - Float precision issues are incorrectly described

2. SCENARIO CHECK: The workplace problem should involve realistic Python programming challenges like: debugging unexpected numeric behavior, handling precision in financial calculations, or resolving type coercion surprises.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about the structural relationship between bool and int, and about float precision limitations.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-float-bool",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      concepts: [
        "Ponto Flutuante",
        "Booleanos como Inteiros",
        "Literais Numéricos",
        "Hierarquia de Tipos",
      ],
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Valores de ponto flutuante e booleanos, sintaxe de literais e a relação estrutural entre bool e int.",
      lessonTitle: "Float e bool como tipos numéricos",
      neighboringConcepts: [
        "Conversão de Tipos",
        "Operadores Aritméticos",
        "Comparação de Valores",
      ],
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
      concepts: [
        "Unemployment Rate",
        "Hours Worked",
        "Labor Force Participation",
        "Discouraged Workers",
      ],
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "Empirical regularities linking downturns to labor market outcomes at the level of aggregate fluctuations, without modeling search or wage-setting mechanisms.",
      lessonTitle: "Labor market aggregates over the cycle",
      neighboringConcepts: ["GDP Growth Rate", "Inflation Targeting", "Fiscal Multiplier"],
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
      concepts: [
        "Acidez en Posición Alfa",
        "Estabilización por Resonancia",
        "Enolato como Nucleófilo",
        "Condensación Aldólica",
      ],
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "Origen de la acidez en α y cómo se forma el enolato como nucleófilo clave en reacciones de construcción C–C.",
      lessonTitle: "Acidez en α y formación de enolatos",
      neighboringConcepts: [
        "Adición Nucleofílica",
        "Reducción de Carbonilos",
        "Protección de Grupos Funcionales",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Legal automation monitoring concepts must be technically sound. Penalize if:
   - Audit requirements are misrepresented for the legal context
   - Quality metrics are described without connection to document safety

2. SCENARIO CHECK: The workplace problem should involve realistic legal tech challenges like: investigating a batch of documents with errors, setting up monitoring for a new automation pipeline, or responding to an audit finding.

3. CONCEPTUAL FOCUS: Decisions should require reasoning about how metrics and audit trails ensure quality and safety in automated legal document generation.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-medicao-automacao",
    userInput: {
      chapterTitle: "Legal tech e automação de documentos",
      concepts: [
        "Métricas de Qualidade Documental",
        "Rastros de Auditoria",
        "Classificação de Erros",
        "Indicadores de Segurança",
      ],
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Métricas operacionais focadas em qualidade e segurança da automação documental, com rastros para auditoria.",
      lessonTitle: "Medição e monitoramento da automação",
      neighboringConcepts: [
        "Templates Jurídicos",
        "Integração com Sistemas Judiciais",
        "Assinatura Digital",
      ],
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
      concepts: [
        "Layer-by-Layer Isolation",
        "Host Configuration Check",
        "Gateway Reachability",
        "Service-Layer Diagnosis",
      ],
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Practical mental models for narrowing a problem to host, subnet, gateway, path, or service-layer reachability without relying on protocol-specific details.",
      lessonTitle: "Connectivity Debugging Mental Models",
      neighboringConcepts: ["Latency Measurement", "Load Balancing", "Network Address Translation"],
    },
  },
];
