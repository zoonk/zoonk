const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. SCENARIO IMMERSION: The intro must drop the learner into a vivid scene with sensory detail and a role that demands immediate action. Second person. No abstract setup or backstory dumps.

2. HIDDEN CONCEPTS: The specific concept names provided in the CONCEPTS input must NEVER appear during play — not in the intro, not in situations, not in choices, not in consequences. Everyday domain vocabulary needed to set the scene (e.g., "virus" in a health scenario, "factory" in a manufacturing scenario) is fine and should NOT be penalized. Only penalize when the actual concept names or their direct synonyms appear.

3. METRIC DESIGN: Metrics must represent meaningful, independent dimensions of the scenario. Metric labels must be simple and domain-appropriate. Initial values must be between 40-60. At least 2 metrics required.

4. CHOICE QUALITY: Every step must have at least 3 choices. All choices must be plausible actions in context — no obviously wrong or absurd options. Choices must be actions (imperative form), not opinions or meta-commentary. Each choice must be immediately understandable without jargon.

5. ALIGNMENT CALIBRATION: Each step must have a mix of strong, partial, and weak choices. The "strong" choice should NOT be obviously correct — it might feel counterintuitive. The alignment should never be hinted at in the choice text or consequence.

6. CONSEQUENCE QUALITY: Consequences must show what HAPPENS, not explain why. They must be concrete with human/emotional detail ("Three workers walk off the line") rather than evaluative ("This was inefficient"). Consequences should make the learner go "oh, I see."

7. METRIC EFFECTS: Each metric name in metricEffects must match a defined metric label. Effects must be "positive", "neutral", or "negative". Strong choices should generally have positive effects, weak choices should generally have negative effects, partial choices should have mixed effects.

8. STEP ESCALATION: Steps must build a progressive narrative. Step 1 should be manageable. Middle steps should escalate with surprises or complications. Late steps should feel like pressure is building toward a crisis or breakthrough.

9. LENGTH CONSTRAINTS: Verify these limits:
   - intro: max 30 words, max 2 sentences
   - situation: max 30 words, max 2-3 sentences
   - choice text: max 15 words, 1 sentence
   - consequence: max 30 words, max 2-3 sentences
   Do NOT penalize for being slightly under these limits. Only penalize for clearly exceeding them.

10. FORMAT: Output must be valid JSON with: intro (string), metrics (array of {label, initial}), steps (array of {situation, choices}).

11. FACTUAL ACCURACY: Domain content must be factually correct. Penalize choices or consequences that misrepresent how the topic actually works.

12. VOICE: Casual, conversational register. No academic or corporate tone. No jargon from the topic.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific scenario settings, character names, or plot choices
- Do NOT require exactly 5 steps or exactly 3 metrics — these are guidance, not hard constraints
- Do NOT penalize for the exact number of choices per step as long as there are at least 3
- Do NOT penalize for creative or unconventional scenarios that still teach the concepts
- Do NOT penalize for metric initial values anywhere in the 40-60 range
- Do NOT check against an imagined "ideal" story structure
- Do NOT penalize for everyday domain vocabulary that sets the scene (e.g., "virus", "factory", "reaction") — only penalize when actual CONCEPT names from the input appear
- ONLY penalize for: actual concept names leaking into play, evaluative consequences instead of concrete ones, obviously wrong choices, missing alignment diversity, format violations, or factually incorrect domain content
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
    id: "pt-python-tipos-numericos-principais",
    userInput: {
      chapterTitle: "Tipos numéricos e valores especiais",
      concepts: [
        "Objetos numéricos em Python",
        "Imutabilidade dos números",
        "Tipo int",
        "Tipo float",
        "Tipo complex",
        "Tipo bool",
        "Valor None",
      ],
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Os principais valores numéricos e especiais da linguagem, com a identidade de cada tipo embutido e o papel de None fora da família numérica.",
      topic: "Tipos numéricos principais",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-formacion-enoles-enolatos",
    userInput: {
      chapterTitle: "Carbonilos y enolatos",
      concepts: [
        "Enolización catalizada por ácido",
        "Enolización catalizada por base",
        "Desprotonación alfa",
        "Reprotonación del enolato",
        "Enolato de litio",
        "Enolato de sodio",
      ],
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "La generación de enoles y enolatos depende del medio de reacción, del tipo de base y del catión presente.",
      topic: "Formación de enoles y enolatos",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-economics-sectoral-comovements",
    userInput: {
      chapterTitle: "Business cycles",
      concepts: [
        "Comovement Across Industries",
        "Comovement Across Regions",
        "Sectoral Dispersion",
        "Manufacturing Cyclicality",
        "Construction Cyclicality",
        "Services Cyclicality",
      ],
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "How cyclical fluctuations differ across parts of the economy while still sharing common aggregate patterns.",
      topic: "Sectoral and Regional Comovements",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-medicao-desempenho",
    userInput: {
      chapterTitle: "Legal tech e automação de documentos",
      concepts: [
        "Métrica de uso do template",
        "Taxa de retrabalho documental",
        "Tempo de geração",
        "Taxa de erro documental",
        "Aderência ao padrão",
        "Feedback de usuário interno",
      ],
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Indicadores voltados ao desempenho dos modelos automatizados e à melhoria contínua da qualidade documental.",
      topic: "Medição de desempenho documental",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-history-covid-pandemic-governance",
    userInput: {
      chapterTitle: "Health and disease",
      concepts: [
        "COVID-19 in Brazil",
        "Coronavirus Transmission",
        "Non-Pharmaceutical Interventions",
        "Hospital System Overload",
        "Vaccine Procurement",
        "COVID-19 Denialism",
        "Federal-State Conflict in the Pandemic",
        "Excess Mortality",
      ],
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "The main epidemiological and political dimensions of the COVID-19 crisis in Brazil. These concepts track transmission control, system strain, vaccination, denialism, and intergovernmental conflict.",
      topic: "COVID-19 Crisis and Pandemic Governance",
    },
  },
];
