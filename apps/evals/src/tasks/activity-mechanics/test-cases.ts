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
      courseTitle: "Web Development",
      explanationSteps: [
        {
          text: "Encapsulation wraps data with headers at each network layer. Each layer adds its own addressing and control information, like putting a letter in a series of labeled envelopes.",
          title: "Encapsulation",
        },
        {
          text: "Each network device along the path reads only its layer's header, makes a forwarding decision, and passes the data to the next hop. No device sees the full picture.",
          title: "Hop-by-Hop Forwarding",
        },
        {
          text: "The maximum transmission unit limits how much data fits in a single frame. Data larger than the MTU must be fragmented into smaller pieces for transit.",
          title: "Size Constraints",
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
      courseTitle: "Python",
      explanationSteps: [
        {
          text: "Floats representam números com parte decimal usando ponto flutuante. A notação 3.14 ou 2.0e10 cria literais float em Python.",
          title: "Literais Float",
        },
        {
          text: "Bool é uma subclasse de int em Python. True equivale a 1 e False equivale a 0, permitindo operações aritméticas diretas com booleanos.",
          title: "Bool como Inteiro",
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
      courseTitle: "Economics",
      explanationSteps: [
        {
          text: "The unemployment rate measures the share of the labor force actively seeking work but unable to find it. It rises during recessions but typically lags behind GDP declines.",
          title: "Unemployment Rate",
        },
        {
          text: "Average hours worked per employee often fall before headcount does. Firms reduce overtime first, making hours a leading indicator of labor market stress.",
          title: "Hours Worked",
        },
        {
          text: "Labor force participation measures who is working or looking for work. It drops during prolonged downturns as discouraged workers stop searching entirely.",
          title: "Participation Rate",
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
      courseTitle: "Química",
      explanationSteps: [
        {
          text: "Los hidrógenos en posición α, junto al carbonilo, son inusualmente ácidos. La base sustrae este hidrógeno y el par de electrones se deslocaliza hacia el oxígeno del carbonilo.",
          title: "Acidez en Posición α",
        },
        {
          text: "El enolato resultante es un carbanión estabilizado por resonancia. La carga negativa se reparte entre el carbono α y el oxígeno, creando un nucleófilo ambidente.",
          title: "Estabilización por Resonancia",
        },
        {
          text: "Como nucleófilo, el enolato ataca electrófilos en el carbono α, formando nuevos enlaces C–C. Esta reactividad es la base de condensaciones aldólicas y de Claisen.",
          title: "Enolato como Nucleófilo",
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
      courseTitle: "Direito",
      explanationSteps: [
        {
          text: "Métricas de qualidade medem a taxa de erros em documentos automatizados — cláusulas faltantes, dados incorretos ou formatação quebrada. Cada erro é classificado por gravidade.",
          title: "Métricas de Qualidade",
        },
        {
          text: "Rastros de auditoria registram cada etapa da geração documental: quem solicitou, qual template foi usado, quais dados alimentaram o documento e quando foi revisado.",
          title: "Rastros de Auditoria",
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
      courseTitle: "Web Development",
      explanationSteps: [
        {
          text: "Start at the host: check if the network interface is up and has a valid IP. If the machine itself is misconfigured, nothing beyond it will work.",
          title: "Host-Level Check",
        },
        {
          text: "Test the local subnet by reaching the default gateway. If this fails, the problem is between your machine and the first router — a local network issue.",
          title: "Subnet and Gateway",
        },
        {
          text: "If the gateway responds but the destination doesn't, the problem is somewhere along the path — a routing issue, a firewall, or the remote host itself.",
          title: "Path and Service Layer",
        },
      ],
      language: "en",
      lessonDescription:
        "Practical mental models for narrowing a problem to host, subnet, gateway, path, or service-layer reachability without relying on protocol-specific details.",
      lessonTitle: "Connectivity Debugging Mental Models",
    },
  },
];
