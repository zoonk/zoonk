const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. SCENARIO QUALITY: The scenario must present a genuine mystery or problem — something unexpected that demands investigation. It must NOT be a definition, trivia question, or textbook exercise. Second person, vivid, concrete, 2-3 short sentences. Should read like a hook, not a briefing — punchy but clear enough to understand the mystery.

2. NO META SCENARIOS: The scenario must be a real-world problem that exists independently of the concept being taught. A scenario about "investigating how X works" is meta. A scenario about "a system broke and you need to find out why" is real. Penalize any scenario that only makes sense as an educational exercise about the concept.

3. HIDDEN CONCEPTS: The specific concept names provided in the CONCEPTS input must NEVER appear verbatim during play. However, DO NOT do word-matching — think about context. A networking investigation MUST use words like "server", "request", "timeout". A chemistry investigation MUST mention "reaction", "compound", "mixture". Only penalize when the output explicitly names the concept as a concept (e.g., "This is an example of NaN propagation" or "You just observed enolization").

4. EXPLANATION PLAUSIBILITY AND LENGTH: All 3-4 explanations must be genuinely plausible. None should be obviously correct or obviously wrong before investigation. Each explanation should be one concise sentence — clear enough to understand without extra context. All explanations must be similar in length and tone — none should stand out by being longer, more detailed, or more carefully worded.

5. NO ACCURACY TIERS IN THIS TASK: This task intentionally does NOT include accuracy tiers (best/partial/wrong). Accuracy is assigned by a separate downstream task. Do NOT penalize for missing accuracy labels — they are not expected in the output.

6. FACTUAL ACCURACY: The scenario and explanations must be factually correct for the domain. Explanations should represent genuinely different theories about what happened that make sense given the scenario.

7. LANGUAGE: All content must be in the specified language. Only JSON field names should be in English. No English words slipping into non-English content.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific scenario settings or plot choices
- Do NOT require exact counts as long as within specified ranges (3-4 explanations)
- Do NOT penalize for creative or unconventional investigation scenarios that still teach the concepts
- Do NOT do word-matching for concept leaks — think about whether the word is part of the scenario's natural language
- ONLY penalize for: obviously correct explanations, factual errors, meta scenarios, concept names used as concepts during play, explanations with uneven specificity/confidence
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-web-packets-network-paths",
    userInput: {
      chapterTitle: "Networking fundamentals",
      concepts: [
        "Network Packets",
        "Packet Headers",
        "Packet Payload",
        "Source Address",
        "Destination Address",
        "Hop",
        "Round Trip",
        "Path Through a Network",
      ],
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "The basic units of network communication and the path traffic follows between two endpoints. These concepts build the mental model needed before IP, routing, and transport behavior make sense.",
      topic: "Packets and Network Paths",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-inf-nan",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      concepts: [
        "math.isinf()",
        "math.isnan()",
        "NaN não igual a si mesmo",
        "Propagação de NaN",
        "Operações com infinito",
        "Estouro para infinito",
      ],
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Como identificar infinitos e NaN, além dos comportamentos menos intuitivos desses valores em comparações e operações.",
      topic: "Comportamento de inf e NaN",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-alquilacion-alfa",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      concepts: [
        "Alquilación de enolatos",
        "Electrófilo primario en alquilación alfa",
        "Polialquilación de enolatos",
        "Alquilación de cetonas no simétricas",
        "Enaminas de Stork",
        "Alquilación vía enamina",
      ],
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "La formación de enlaces carbono-carbono en posición alfa puede lograrse con enolatos o enaminas, con atención especial a la selectividad y la evitación de polialquilación.",
      topic: "Alquilación en posición alfa",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-economics-business-cycle-phases",
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
        "The recurring rise and fall of aggregate economic activity, with the standard turning points and phase labels used to describe the path of the economy.",
      topic: "Business Cycle Phases",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-transformacao-gradual",
    userInput: {
      chapterTitle: "Arquitetura em ambientes ágeis",
      concepts: [
        "Evolução incremental da arquitetura",
        "Estrangulamento arquitetural",
        "Extração de módulo",
        "Substituição progressiva",
        "Migração por fatias",
        "Convivência entre arquiteturas",
      ],
      courseTitle: "Metodologias Ágeis",
      language: "pt",
      lessonDescription:
        "Estratégias para transformar a arquitetura sem reescrever tudo de uma vez. A mudança é conduzida em etapas pequenas, preservando a operação contínua do sistema existente.",
      topic: "Transformação arquitetural gradual",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-history-biomedical-institutions",
    userInput: {
      chapterTitle: "Health and disease",
      concepts: [
        "Fiocruz",
        "Butantan Institute",
        "Biomedical Research",
        "Vaccine Production",
        "Public Laboratories",
      ],
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Research and production institutions that became central to Brazilian public health capacity. The focus is on domestic science infrastructure and vaccine self-sufficiency.",
      topic: "Biomedical Institutions and Vaccine Capacity",
    },
  },
];
