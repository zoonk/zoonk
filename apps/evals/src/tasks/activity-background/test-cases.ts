const SHARED_EXPECTATIONS = `
  EVALUATION CRITERIA (focus on storytelling quality, not specific content):

  1. STORYTELLING FLOW: The steps should build curiosity and follow a narrative arc. Check for tension (the problem/limitation) and resolution (how it was solved). IMPORTANT: "narrative arc" does NOT require a historical timeline. A conceptual narrative using metaphors and scenarios (e.g., "imagine your money shrinking") is equally valid as a historical narrative (e.g., "in ancient Rome..."). Both approaches can have tension and resolution.

  2. STEP SIZING: Each step must have a title (max 50 chars) and text (max 300 chars). Verify lengths are within limits.

  3. CONVERSATIONAL TONE: The writing should feel like talking to a curious friend, not reading an encyclopedia. Look for vivid imagery and emotional engagement.

  4. METAPHORS & ANALOGIES: Check that the writing uses analogies or vivid imagery to make abstract concepts tangible. The prompt suggests everyday life examples (sports, cooking, games, music, travel), but domain-appropriate metaphors are equally valid. For example, art-specific imagery for an art topic or historical scenes for a history topic are perfectly fine. Do NOT penalize for using metaphors outside the suggested categories.

  5. FOCUS ON "WHY": The activity explains the origin and importance of a topic — NOT how it works technically. If the output dives into detailed mechanics, implementation, or jargon, that's a problem. However, high-level conceptual descriptions through analogies (e.g., "like nesting dolls, each containing a smaller version") are acceptable — explaining WHAT a concept does at an intuitive level is often necessary to explain WHY it matters.

  6. APPROPRIATE SCOPE: Content should match the lesson's scope exactly — not broader (covering the whole field) and not narrower (covering only a sub-topic).

  7. VIVID SCENES: Each step should feel like a "scene" with imagery, not a bullet point of dry facts.

  IMPORTANT: Do NOT penalize for specific historical facts, dates, or phases you might expect. Different valid narrative approaches exist. Focus on whether the story provided is engaging and explains WHY this topic matters.

  IMPORTANT: Do NOT require a specific number of steps. Simple topics may need fewer steps; complex topics may need more. Judge quality, not quantity.

  IMPORTANT: Make sure the output is factually correct. It should not include any information that is not true.

  IMPORTANT: Do NOT penalize for JSON structure choices (e.g., returning { "steps": [...] } vs a bare array). Focus exclusively on the content quality of the steps themselves.

  IMPORTANT: A "Background" story can take many valid forms — historical narrative, conceptual metaphor journey, scenario-based explanation, or a mix. Do NOT require a specific approach. A well-crafted conceptual narrative with vivid metaphors and clear tension/resolution is just as valid as a historical origin story.
`;

export const TEST_CASES = [
  {
    expectations: `
      Avoid diving into protocol specifics, packet header formats, or byte-level details. The background should explain WHY data needs encapsulation and hop-by-hop forwarding — not HOW specific protocols implement it.

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
      Titles and descriptions must be in Portuguese.

      Avoid diving into IEEE 754 representation, bit-level details, or type conversion syntax. The background should explain WHY floating-point numbers and booleans exist as distinct numeric types and what problems they solve — not HOW they are implemented internally.

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
      Avoid diving into econometric models, regression specifications, or search-and-matching theory. The background should explain WHY economists study how labor markets behave during economic downturns and what empirical patterns emerge — not HOW to model unemployment dynamics.

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
      Titles and descriptions must be in Spanish.

      Avoid diving into orbital theory, pKa calculations, or detailed reaction mechanisms. The background should explain WHY α-hydrogen acidity matters and what role enolates play as nucleophiles in carbon-carbon bond formation — not HOW to calculate acidity or draw mechanisms step by step.

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
      Titles and descriptions must be in Portuguese.

      Avoid diving into specific software platforms, dashboard configurations, or audit log schemas. The background should explain WHY measuring and monitoring document automation matters for legal practice quality and safety — not HOW to implement specific metrics systems.

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
      Avoid diving into specific CLI tools, traceroute output interpretation, or protocol-level diagnostics. The background should explain WHY developers need mental models for connectivity debugging and what happens without systematic approaches — not HOW to use specific debugging tools.

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
