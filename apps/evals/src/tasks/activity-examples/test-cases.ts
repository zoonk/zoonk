const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. PRACTICAL DEMONSTRATIONS: Content must include concrete, hands-on demonstrations appropriate to the subject (code snippets for programming, formulas for math, worked calculations for science, analysis frameworks for humanities). Penalize abstract descriptions without concrete examples.

2. PROCESS EXPLANATION: Content should show HOW things work — processes in action, cause-effect relationships, what happens under the hood. Look for action verbs and sequential flow alongside demonstrations.

3. REAL-WORLD RELEVANCE: At least 1-2 steps must connect the topic to real-world contexts — daily life, work, entertainment, or unexpected places. Penalize if ALL steps are purely abstract/academic.

4. FORMAT: Each step must have a title (max 50 chars) and text (max 300 chars).

5. TONE: Conversational, like a tutor demonstrating and pointing out real-world connections. Include specific examples, not vague generalities.

6. FOCUS: Shows HOW something works (practical demonstrations, processes) and WHERE it appears (real-world contexts), not WHAT it is (definitions) or WHY it exists (history).

7. NO OVERLAP: Must not repeat content from the EXPLANATION_STEPS which covered the WHAT.

8. SCOPE: Content matches the lesson scope exactly.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing specific demonstrations or contexts you might expect
- Do NOT require a specific number of steps or specific balance between demonstration and context
- Do NOT check against an imagined "complete" list of demonstrations or applications
- Do NOT penalize for JSON structure or output format (e.g., wrapping in an object vs returning a raw array). The output uses a structured schema — evaluate ONLY the content quality of titles and text, not how the data is structured
- ONLY penalize for: incorrect claims, abstract content without concrete demonstrations, missing real-world connection entirely, overlap with explanation content, or lack of practical examples
- Different valid demonstration sets exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Data movement demonstrations must reflect genuine networking behavior. Penalize if:
   - Demonstrations confuse data movement with data storage or processing
   - Process descriptions have incorrect sequences (e.g., centralized forwarding decisions instead of hop-by-hop)

2. DEMONSTRATION CHECK: Should include practical examples of how encapsulation, forwarding, or fragmentation work — packet structure examples, hop-by-hop routing visualization, MTU-related behavior. Penalize if content only describes what these concepts are without showing them in action.

3. REAL-WORLD CHECK: Should connect to contexts beyond web browsing — video streaming, online gaming, IoT devices, video calls, cloud computing, mobile apps.

4. DISTINCTION FROM EXPLANATION: The explanation covered WHAT encapsulation and forwarding are. This should show HOW data actively moves through the network and WHERE these concepts visibly operate in everyday technology.

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

1. ACCURACY CHECK: Float and bool demonstrations must reflect genuine Python behavior. Penalize if:
   - Float arithmetic is described as exact (floating-point has inherent precision limitations)
   - Bool arithmetic results are described incorrectly (True + True = 2, not True)

2. DEMONSTRATION CHECK: Should include practical code examples showing float operations, bool arithmetic, type coercion, or literal syntax. Penalize if content only describes what these types are without showing them working in code.

3. REAL-WORLD CHECK: Should connect beyond basic math — data analysis, conditional logic, scientific computing, web forms, configuration flags, game development.

4. DISTINCTION FROM EXPLANATION: The explanation covered WHAT floats and bools are. This should show HOW Python processes these types in practice and WHERE they appear in real programming scenarios.

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

1. ACCURACY CHECK: Labor market cycle demonstrations must reflect genuine economic dynamics. Penalize if:
   - Layoffs are described as the first response to downturns (firms typically reduce hours first)
   - Recovery is described as symmetric to contraction (labor markets recover more slowly)

2. DEMONSTRATION CHECK: Should include practical examples of how labor aggregates change — staged adjustment sequences, specific indicator movements during downturns, or worked-through scenarios of economic cycles. Penalize if content only lists where cycles happen without showing the process.

3. REAL-WORLD CHECK: Should connect beyond factory layoffs — gig workers, recent graduates, service industries, construction, retail hiring, government employment.

4. DISTINCTION FROM EXPLANATION: The explanation covered WHAT unemployment rate, hours, and participation are. This should show HOW these aggregates actively change during cycles and WHERE cyclical patterns visibly affect people's lives.

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

1. ACCURACY CHECK: Enolate chemistry demonstrations must reflect genuine chemical behavior. Penalize if:
   - The base is described as attacking the carbon rather than abstracting the α-hydrogen
   - Resonance stabilization is described as occurring before deprotonation

2. DEMONSTRATION CHECK: Should include practical demonstrations of the enolate formation process — deprotonation steps, electron delocalization, nucleophilic attack on electrophiles, or worked-through reaction mechanisms. Penalize if content only lists where enolates are used without showing how the chemistry works.

3. REAL-WORLD CHECK: Should connect beyond textbook reactions — pharmaceutical synthesis, fragrance chemistry, polymer production, natural product biosynthesis, food chemistry.

4. DISTINCTION FROM EXPLANATION: The explanation covered WHAT α-acidity and enolates are. This should show HOW the deprotonation and C–C bond formation processes work and WHERE these reactions appear in real chemical applications.

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

1. ACCURACY CHECK: Legal automation monitoring demonstrations must reflect genuine legal practice. Penalize if:
   - Monitoring is described as a one-time setup rather than an ongoing process
   - Audit trail descriptions don't match real compliance requirements

2. DEMONSTRATION CHECK: Should include practical examples of monitoring in action — how metrics are collected, how errors are detected and classified, how audit trails trace document generation. Penalize if content only lists where monitoring exists without showing how it works.

3. REAL-WORLD CHECK: Should connect beyond contract generation — litigation document assembly, regulatory filings, due diligence reports, corporate governance documents, notarial acts.

4. DISTINCTION FROM EXPLANATION: The explanation covered WHAT quality metrics and audit trails are. This should show HOW monitoring processes actively work and WHERE automation monitoring matters in real legal practice.

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

1. ACCURACY CHECK: Connectivity debugging demonstrations must reflect genuine troubleshooting. Penalize if:
   - The debugging process skips layers or tests them out of order
   - Reachability tests are described without explaining what each result tells you

2. DEMONSTRATION CHECK: Should include practical examples of working through connectivity problems — step-by-step layer isolation, specific commands or checks at each layer, interpreting results to narrow faults. Penalize if content only describes what mental models are without showing the debugging process.

3. REAL-WORLD CHECK: Should connect beyond web server issues — home Wi-Fi troubleshooting, cloud deployments, mobile app connectivity, IoT device setup, VPN problems, microservice communication failures.

4. DISTINCTION FROM EXPLANATION: The explanation covered WHAT the debugging mental models are. This should show HOW you actively work through a connectivity problem and WHERE these approaches help in real-world scenarios.

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
