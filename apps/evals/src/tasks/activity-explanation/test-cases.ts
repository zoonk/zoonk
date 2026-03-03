const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: Any scientific processes, mechanisms, or technical details must be correct. Penalize hallucinations, made-up components, or incorrect cause-effect relationships.

2. DEPTH: Complex topics require multi-layered explanations. Penalize superficial overviews that skip essential mechanisms.

3. CLARITY: Steps should build understanding progressively, explaining concepts in accessible language.

4. FORMAT: Each step must have a title (max 50 chars) and text (max 300 chars).

5. TONE: Conversational, like explaining to a curious friend. Include analogies from everyday life.

6. FOCUS: Explains WHAT something IS, not history or origin stories.

7. NO OVERLAP: Must not repeat content from the BACKGROUND_STEPS.

8. SCOPE: Content matches the lesson scope exactly.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing components, phases, or concepts you might expect
- Do NOT require a specific number of steps
- Do NOT check against an imagined "complete" explanation
- Do NOT penalize for output format or structure (e.g., JSON wrapping, key names, array nesting). We use structured outputs, so focus exclusively on content quality
- Do NOT penalize for the ordering of explanation steps. Different valid structures and sequences exist
- ONLY penalize for: factual errors, superficial treatment of complex topics, not using the conversational tone (everyday language) we asked or poor explanation structure
- Different valid explanatory approaches exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Network data movement involves specific concepts like encapsulation, protocol layers, and hop-by-hop forwarding. Penalize if:
   - Encapsulation is confused with encryption (encapsulation wraps data with headers at each layer)

2. DEPTH CHECK: Penalize if the explanation treats data movement as simply "data goes from A to B" without showing how encapsulation and forwarding constraints work together.

3. DISTINCTION FROM BACKGROUND: The background covered WHY data needs layered packaging. This should explain WHAT encapsulation, protocol layers, and hop-by-hop forwarding actually are.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-data-movement",
    userInput: {
      chapterTitle: "Networking fundamentals",
      concept: "Encapsulation",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Core building blocks for how data moves across networks, from encapsulation to hop-by-hop forwarding constraints.",
      lessonTitle: "How Data Moves on Networks",
      neighboringConcepts: [
        "DNS Resolution",
        "TCP Handshake",
        "Socket Programming",
        "Hop-by-Hop Forwarding",
        "Maximum Transmission Unit",
        "Packet Fragmentation",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Python numeric types involve specific relationships between float, bool, and int. Penalize if:
   - bool is described as unrelated to int (bool is a subclass of int in Python)

2. DEPTH CHECK: Penalize if the explanation treats floats and bools as simple "number types" without showing the structural relationship between bool and int, or the significance of floating-point representation.

3. DISTINCTION FROM BACKGROUND: The background covered WHY different numeric types exist. This should explain WHAT floats and bools are, their literal syntax, and how bool relates structurally to int.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-float-bool",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      concept: "Ponto Flutuante",
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Valores de ponto flutuante e booleanos, sintaxe de literais e a relação estrutural entre bool e int.",
      lessonTitle: "Float e bool como tipos numéricos",
      neighboringConcepts: [
        "Conversão de Tipos",
        "Operadores Aritméticos",
        "Comparação de Valores",
        "Booleanos como Inteiros",
        "Literais Numéricos",
        "Hierarquia de Tipos",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Labor market aggregates involve specific empirical patterns during business cycles. Penalize if:
   - Unemployment is described as moving inversely with output without acknowledging lags (unemployment typically lags GDP changes)

2. DEPTH CHECK: Penalize if the explanation treats labor markets during downturns as simply "people lose jobs" without showing the empirical regularities in employment, hours, and participation rates.

3. DISTINCTION FROM BACKGROUND: The background covered WHY labor markets fluctuate with the business cycle. This should explain WHAT the specific empirical patterns are — how unemployment, hours worked, and labor force participation move during downturns.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-labor-cycles",
    userInput: {
      chapterTitle: "Business cycles",
      concept: "Unemployment Rate",
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "Empirical regularities linking downturns to labor market outcomes at the level of aggregate fluctuations, without modeling search or wage-setting mechanisms.",
      lessonTitle: "Labor market aggregates over the cycle",
      neighboringConcepts: [
        "GDP Growth Rate",
        "Inflation Targeting",
        "Fiscal Multiplier",
        "Hours Worked",
        "Labor Force Participation",
        "Discouraged Workers",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: α-acidity and enolate chemistry involve specific chemical concepts. Penalize if:
   - Enolates are described as electrophiles (they are nucleophiles)
   - α-hydrogen acidity is attributed to inductive effects alone (resonance stabilization of the enolate is the primary factor)

2. DEPTH CHECK: Penalize if the explanation treats enolate formation as simply "removing a hydrogen" without showing why the α-position is specifically acidic and how the resulting enolate acts as a nucleophile.

3. DISTINCTION FROM BACKGROUND: The background covered WHY carbon-carbon bond formation matters in organic chemistry. This should explain WHAT α-acidity is and how enolates form as key nucleophiles.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-acidez-enolatos",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      concept: "Acidez en Posición Alfa",
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "Origen de la acidez en α y cómo se forma el enolato como nucleófilo clave en reacciones de construcción C–C.",
      lessonTitle: "Acidez en α y formación de enolatos",
      neighboringConcepts: [
        "Adición Nucleofílica",
        "Reducción de Carbonilos",
        "Protección de Grupos Funcionales",
        "Estabilización por Resonancia",
        "Enolato como Nucleófilo",
        "Condensación Aldólica",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Automation measurement in legal tech involves specific operational metrics. Penalize if:
   - Metrics are described without connection to quality or safety concerns (the focus should be on quality assurance and audit trails)

2. DEPTH CHECK: Penalize if the explanation treats automation monitoring as simply "checking if it works" without showing what specific metrics matter for document quality and safety.

3. DISTINCTION FROM BACKGROUND: The background covered WHY monitoring legal document automation matters. This should explain WHAT operational metrics, quality indicators, and audit trails look like in practice.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-medicao-automacao",
    userInput: {
      chapterTitle: "Legal tech e automação de documentos",
      concept: "Métricas de Qualidade Documental",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Métricas operacionais focadas em qualidade e segurança da automação documental, com rastros para auditoria.",
      lessonTitle: "Medição e monitoramento da automação",
      neighboringConcepts: [
        "Templates Jurídicos",
        "Integração com Sistemas Judiciais",
        "Assinatura Digital",
        "Rastros de Auditoria",
        "Classificação de Erros",
        "Indicadores de Segurança",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Connectivity debugging involves systematic layer-by-layer reasoning. Penalize if:
   - Debugging is described as starting from the application layer down (systematic models typically start from physical/link layer up)
   - Mental models are confused with specific tool outputs (the focus is on reasoning frameworks, not tool usage)

2. DEPTH CHECK: Penalize if the explanation treats debugging as simply "check if it works" without showing how to systematically narrow a connectivity problem to a specific layer — host, subnet, gateway, path, or service.

3. DISTINCTION FROM BACKGROUND: The background covered WHY systematic debugging approaches matter. This should explain WHAT the mental models are — how to reason about reachability at each layer to isolate where connectivity breaks.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-debugging-mental-models",
    userInput: {
      chapterTitle: "Networking fundamentals",
      concept: "Layer-by-Layer Isolation",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "Practical mental models for narrowing a problem to host, subnet, gateway, path, or service-layer reachability without relying on protocol-specific details.",
      lessonTitle: "Connectivity Debugging Mental Models",
      neighboringConcepts: [
        "Latency Measurement",
        "Load Balancing",
        "Network Address Translation",
        "Host Configuration Check",
        "Gateway Reachability",
        "Service-Layer Diagnosis",
      ],
    },
  },
];
