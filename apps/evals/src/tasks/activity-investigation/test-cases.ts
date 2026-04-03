const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. SCENARIO QUALITY: The scenario must present a genuine mystery or problem — something unexpected that demands investigation. It must NOT be a definition, trivia question, or textbook exercise. Second person, vivid, concrete, 2-3 sentences max.

2. NO META SCENARIOS: The scenario must be a real-world problem that exists independently of the concept being taught. A scenario about "investigating how X works" is meta. A scenario about "a system broke and you need to find out why" is real. Penalize any scenario that only makes sense as an educational exercise about the concept.

3. HIDDEN CONCEPTS: The specific concept names provided in the CONCEPTS input must NEVER appear verbatim during play. However, DO NOT do word-matching — think about context. A networking investigation MUST use words like "server", "request", "timeout". A chemistry investigation MUST mention "reaction", "compound", "mixture". Only penalize when the output explicitly names the concept as a concept (e.g., "This is an example of NaN propagation" or "You just observed enolization").

4. AMBIGUITY: Every finding MUST have a complicating factor — a clause that introduces doubt or an alternative interpretation. In English this is typically a "however" clause; in Portuguese "porém"/"no entanto"; in Spanish "sin embargo". The complicating factor must be in the content's language. If any finding presents clear, unambiguous evidence, penalize.

5. EXPLANATION PLAUSIBILITY: All 3-4 explanations must be genuinely plausible. The correct one should NOT be obviously correct before investigation. If a reader can identify the correct explanation without any evidence, the scenario fails.

6. CONCLUSION QUALITY: Exactly 4 conclusion statements, one of each quality level (overclaims, ignoresEvidence, honest, best). The "best" conclusion should acknowledge both what the evidence shows AND its limitations. The "overclaims" conclusion should state certainty beyond the evidence. Do NOT penalize for specific wording — evaluate the quality tier assignment.

7. ACTION QUALITY TIERS: 5-6 total actions. 1-2 critical (directly test the core question), 2-3 useful (valuable supporting evidence), 1-2 weak (tangentially related). Penalize only if the distribution is severely skewed (e.g., all critical, or no critical).

8. TAG ACCURACY: Each correctTag must be objectively correct relative to the problem's truth (the correct explanation). Evaluate whether the tag assignment is defensible given the finding text.

9. FEEDBACK QUALITY: Each finding's feedback must explain WHY the correct tag applies and address why someone might reasonably assign a different tag. Feedback that just restates the finding or says "this is correct" without reasoning should be penalized.

10. VISUAL DESCRIPTIONS: Every scenario and every finding must have a visualDescription and visualKind. Descriptions must be specific enough for a separate system to generate the actual visual — include concrete details like data values for charts, code structure for snippets, column headers for tables, node labels for diagrams. Penalize vague descriptions like "a relevant chart" or "some code".

11. FACTUAL ACCURACY: Domain content must be factually correct. Findings, explanations, and the debrief must accurately represent how the topic actually works.

12. LANGUAGE: All content must be in the specified language. Only JSON field names and enum values (like "supports", "critical", "best") should be in English. No English words slipping into non-English content — including the complicating factor connective (use the target language's equivalent, not "however").

13. DEBRIEF: The fullExplanation must be 2-3 sentences that explain the full picture — what actually happened and why. The correctExplanationIndex must point to the correct explanation.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific scenario settings, investigation angles, or plot choices
- Do NOT require exact counts as long as within specified ranges (3-4 explanations, 5-6 actions, exactly 4 conclusions)
- Do NOT penalize for creative or unconventional investigation scenarios that still teach the concepts
- Do NOT penalize for the specific visual kinds chosen as long as they're appropriate for the evidence type
- Do NOT do word-matching for concept leaks — think about whether the word is part of the scenario's natural language
- ONLY penalize for: findings without complicating factors, obviously correct explanations, factual errors, meta scenarios, vague visual descriptions, concept names used as concepts during play
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
