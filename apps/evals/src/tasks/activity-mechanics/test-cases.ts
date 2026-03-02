const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: Any process descriptions, mechanisms, or cause-effect relationships must be correct. Penalize hallucinations, incorrect sequences, or wrong causal chains.

2. PROCESS FOCUS: Content must show things HAPPENING, not just describe parts. Look for action verbs, cause-effect language, and sequential flow.

3. DEPTH: Complex processes require multi-step explanations showing how one action triggers the next. Penalize oversimplified "just happens" explanations.

4. FORMAT: Each step must have a title (max 50 chars) and text (max 300 chars).

5. TONE: Conversational, like giving a behind-the-scenes tour. Include process metaphors from everyday life (assembly lines, relay races, domino chains).

6. FOCUS: Explains HOW something works (processes in action), not WHAT it is (definitions) or WHY it exists (history).

7. NO OVERLAP: Must not repeat content from the EXPLANATION_STEPS which covered the WHAT.

8. SCOPE: Content matches the lesson scope exactly.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing process phases or steps you might expect UNLESS they are explicitly listed in the TOPIC-SPECIFIC ACCURACY CHECK above
- Do NOT require a specific number of steps
- Do NOT check against an imagined "complete" process description
- Do NOT penalize for JSON output structure (e.g., \`{ "steps": [...] }\` vs a bare array) — only evaluate the content of the steps themselves
- ONLY penalize for: factual errors, static descriptions instead of action-oriented content, missing cause-effect relationships, or poor process flow
- Different valid process explanations exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Network data movement involves active processes of wrapping, routing, and unwrapping. Penalize if:
   - Forwarding decisions are described as centralized (each hop makes independent decisions)
   - Encapsulation and decapsulation are not shown as inverse processes at source and destination

2. DEPTH CHECK: Penalize if the explanation treats data movement as a single action rather than a multi-hop process with encapsulation at each layer.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT encapsulation and forwarding are. This should show HOW data actively moves through the network — the step-by-step process of wrapping, routing, and unwrapping.

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
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Float and bool operations involve specific runtime behaviors. Penalize if:
   - Float arithmetic is described as exact (floating-point has inherent precision limitations)
   - Bool arithmetic results are described incorrectly (True + True = 2, not True)

2. DEPTH CHECK: Penalize if the explanation treats type usage as static definitions rather than showing how Python processes float literals, bool operations, and type coercion in action.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT floats and bools are. This should show HOW Python processes these types — parsing literals, performing arithmetic, and handling the bool-int relationship at runtime.

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

1. ACCURACY CHECK: Labor market adjustment during cycles involves specific dynamic processes. Penalize if:
   - Layoffs are described as the first response to downturns (firms typically reduce hours and overtime first)
   - Recovery is described as symmetric to contraction (labor markets recover more slowly than they contract)

2. DEPTH CHECK: Penalize if the explanation treats cyclical labor adjustment as a single event rather than a staged process of hours reduction, hiring freezes, layoffs, and discouraged worker effects.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT unemployment rate, hours, and participation are. This should show HOW these aggregates actively change during a downturn — the sequence and timing of adjustments.

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
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Enolate formation involves a specific sequence of proton abstraction and resonance stabilization. Penalize if:
   - The base is described as attacking the carbon rather than abstracting the α-hydrogen
   - Resonance stabilization is described as occurring before deprotonation (it results from deprotonation)

2. DEPTH CHECK: Penalize if the explanation treats enolate formation as a single step rather than showing the process of base approach, proton abstraction, electron delocalization, and nucleophilic attack.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT α-acidity and enolates are. This should show HOW the deprotonation process occurs and HOW the enolate actively attacks electrophiles to form C–C bonds.

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
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Automation monitoring involves active measurement and feedback processes. Penalize if:
   - Monitoring is described as a one-time setup rather than an ongoing process
   - Audit trails are described without showing how they capture the generation pipeline in action

2. DEPTH CHECK: Penalize if the explanation treats monitoring as simply "looking at dashboards" without showing how metrics are collected, how errors are detected, and how audit trails trace document generation step by step.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT quality metrics and audit trails are. This should show HOW they actively work — the process of measuring, detecting anomalies, and tracing document generation.

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

1. ACCURACY CHECK: Connectivity debugging involves a systematic process of elimination. Penalize if:
   - The debugging process skips layers or tests them out of order (systematic approaches work layer by layer)
   - Reachability tests are described without explaining what each result tells you about where the problem lies

2. DEPTH CHECK: Penalize if the explanation treats debugging as a single check rather than showing the sequential process of testing host config, local subnet, gateway, path, and service-layer reachability.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT the debugging mental models are. This should show HOW you actively work through a connectivity problem — the step-by-step process of testing each layer and interpreting results to narrow the fault.

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
