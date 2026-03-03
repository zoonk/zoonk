const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. REAL-WORLD RELEVANCE: Examples must be concrete, recognizable situations from everyday life. Penalize abstract or theoretical applications without clear real-world grounding.

2. CONTEXT DIVERSITY: Content should show the topic across different life domains (daily life, work, entertainment, unexpected places, personal interests). Variety helps different learners connect.

3. RECOGNITION FACTOR: Examples should create "aha moments" — helping learners see the topic in familiar places they hadn't noticed before.

4. FORMAT: Each step must have a title (max 50 chars) and text (max 300 chars).

5. TONE: Conversational, like pointing out hidden patterns in everyday life. Include metaphors and analogies from familiar activities.

6. FOCUS: Shows WHERE something appears (real-world contexts), not WHAT it is (definitions) or HOW it works (processes).

7. NO OVERLAP: Must not repeat content from the EXPLANATION_STEPS which covered the WHAT.

8. SCOPE: Content matches the lesson scope exactly.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for missing specific life domains or contexts you might expect
- Do NOT require a specific number of contexts or examples
- Do NOT check against an imagined "complete" list of applications
- Do NOT penalize for JSON structure or output format (e.g., wrapping in an object vs returning a raw array). The output uses a structured schema — evaluate ONLY the content quality of titles and text, not how the data is structured
- ONLY penalize for: incorrect real-world claims, abstract examples without concrete situations, overlap with explanation content, or lack of variety in context types
- Different valid sets of examples exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Data movement examples must reflect genuine networking scenarios. Penalize if:
   - Examples confuse data movement with data storage or processing
   - Real-world networking claims are technically inaccurate

2. CONTEXT CHECK: Penalize if examples are limited to web browsing. Data movement concepts appear in video streaming, online gaming, IoT devices, video calls, cloud computing, and mobile apps.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT encapsulation and forwarding are. This should show WHERE these concepts visibly operate in everyday technology use.

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

1. ACCURACY CHECK: Float and bool examples must reflect genuine Python behavior. Penalize if:
   - Examples misrepresent floating-point precision issues
   - Bool arithmetic examples are mathematically incorrect

2. CONTEXT CHECK: Penalize if examples are limited to basic math. Float and bool types appear in data analysis, conditional logic, scientific computing, web forms, configuration flags, and game development.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT floats and bools are. This should show WHERE these types appear in real programming scenarios and daily computing.

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

1. ACCURACY CHECK: Labor market cycle examples must reflect genuine economic dynamics. Penalize if:
   - Examples attribute unemployment changes to single causes when multiple factors interact
   - Historical claims about specific recessions are factually inaccurate

2. CONTEXT CHECK: Penalize if examples are limited to factory layoffs. Labor market cycles affect gig workers, recent graduates, service industries, construction, retail hiring, and government employment.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT unemployment rate, hours, and participation are. This should show WHERE these cyclical patterns visibly affect people's lives and communities.

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

1. ACCURACY CHECK: Enolate chemistry examples must reflect genuine chemical applications. Penalize if:
   - Examples misrepresent where enolate reactions occur in synthesis
   - Industrial or pharmaceutical applications are factually inaccurate

2. CONTEXT CHECK: Penalize if examples are limited to textbook reactions. α-acidity and enolates appear in pharmaceutical synthesis, fragrance chemistry, polymer production, natural product biosynthesis, and food chemistry.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT α-acidity and enolates are. This should show WHERE these concepts appear in real chemical applications and industries.

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

1. ACCURACY CHECK: Legal automation monitoring examples must reflect genuine legal practice. Penalize if:
   - Examples misrepresent how legal documents are generated or reviewed
   - Audit trail descriptions don't match real compliance requirements

2. CONTEXT CHECK: Penalize if examples are limited to contract generation. Automation monitoring appears in litigation document assembly, regulatory filings, due diligence reports, corporate governance documents, and notarial acts.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT quality metrics and audit trails are. This should show WHERE automation monitoring matters in real legal practice scenarios.

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

1. ACCURACY CHECK: Connectivity debugging examples must reflect genuine troubleshooting scenarios. Penalize if:
   - Examples misattribute connectivity failures to the wrong network layer
   - Mental model applications are technically inaccurate

2. CONTEXT CHECK: Penalize if examples are limited to web server issues. Debugging mental models appear in home Wi-Fi troubleshooting, cloud deployments, mobile app connectivity, IoT device setup, VPN problems, and microservice communication failures.

3. DISTINCTION FROM EXPLANATION: The explanation covered WHAT the debugging mental models are. This should show WHERE these systematic approaches help in real-world connectivity problems people encounter.

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
