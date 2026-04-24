const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. REAL APPLIED SCENARIO: The intro must put the learner in one believable role solving a real problem. It must not be a classroom, study, presentation, explainer, report-for-readers, or disguised teaching setup.

2. EXPLANATION TRANSFER: The planned story must apply the ideas from EXPLANATION_STEPS in a new real-world case. It should preserve conceptual progression without copying the explanation's classroom examples, characters, artifacts, or sequence.

3. HIDDEN CONCEPTS: The specific concept names provided in CONCEPTS should not be explicitly taught or named as lesson concepts during play. Natural domain language is allowed when professionals would use it.

4. METRIC DESIGN: Metrics must represent meaningful, independent tradeoff dimensions of the scenario. Metric labels must be simple, domain-appropriate, stable across the whole story, and have an obvious positive direction.

5. PROBLEM QUALITY: Each step problem should sound like a colleague in the work session naming what is going wrong, why it matters, and what decision is live. It must not merely describe the image or reveal the diagnosis too directly.

6. IMAGE PROMPT QUALITY: Image prompts must be self-contained, focused on one primary artifact or operating state, and specific enough to prevent drift. Step image prompts should make the relevant evidence legible rather than showing a noisy scene.

7. STEP ESCALATION: Steps must build a progressive work session. Step 1 should be manageable; later steps should add new evidence, constraints, or stakes without becoming melodramatic.

8. OUTCOME TIERS: Outcomes must use the fixed keys perfect, good, ok, bad, terrible. Each tier should be a believable final state of the same scenario, not a lesson recap.

9. NO CHOICES IN THIS TASK: This task should generate the story plan only. It should not include choice labels, consequences, choice alignments, metricEffects, or stateImagePrompt fields inside steps.

10. LENGTH CONSTRAINTS: Verify these limits:
   - intro: max 30 words, max 2 sentences
   - problem: max 26 words, max 2 sentences
   - outcome title: max 5 words, 1 sentence
   - outcome narrative: max 40 words, max 3 sentences
   Do NOT penalize for being slightly under these limits. Only penalize for clearly exceeding them.

11. FACTUAL ACCURACY: Domain content must be factually correct. Penalize planned problems, metrics, image prompts, or outcomes that misrepresent how the topic actually works.

12. VOICE: Grounded conversational work-session voice. No narrator voice, no academic tone, no corporate filler, and no app-instruction language like "your task is."

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific scenario settings, character names, or plot choices
- Do NOT require exactly 5 steps or exactly 3 metrics — these are guidance, not hard constraints
- Do NOT penalize for creative or unconventional scenarios that still teach the concepts
- Do NOT penalize for the number of metrics as long as there are at least 2
- Do NOT check against an imagined "ideal" story structure
- Do NOT do word-matching for concept leaks — think about whether the word is part of the scenario's natural language or an explicit concept reveal
- ONLY penalize for: classroom/explainer setups, explicit concept teaching during play ("This is called X"), noisy or under-specified image prompts, missing conceptual transfer, or factually incorrect domain content
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
      explanationSteps: [
        {
          text: "A packet is a small unit of data traveling through the network with routing information wrapped around its content.",
          title: "Packets move",
        },
        {
          text: "Headers guide each hop, while the payload is the actual message being delivered.",
          title: "Headers and payload",
        },
        {
          text: "Traffic may cross multiple hops before the response completes a round trip.",
          title: "Paths and replies",
        },
      ],
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
      explanationSteps: [
        {
          text: "Em Python, números são objetos com tipos próprios, como int, float, complex e bool.",
          title: "Tipos numéricos",
        },
        {
          text: "Números são imutáveis: uma operação cria outro valor em vez de alterar o objeto original.",
          title: "Imutabilidade",
        },
        {
          text: "None representa ausência de valor e não pertence à família dos números.",
          title: "Ausência de valor",
        },
      ],
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
      explanationSteps: [
        {
          text: "La formación de enoles o enolatos depende del medio de reacción y de cómo se mueve el protón alfa.",
          title: "Medio de reacción",
        },
        {
          text: "En medio básico, una base retira el protón alfa y forma un enolato que luego puede reprotonarse.",
          title: "Enolato",
        },
        {
          text: "El catión presente, como litio o sodio, cambia el comportamiento práctico del enolato.",
          title: "Catión",
        },
      ],
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
      explanationSteps: [
        {
          text: "Industries often move together during a business cycle, but some sectors swing more strongly than others.",
          title: "Shared cycle",
        },
        {
          text: "Regional patterns can comove with national conditions while still showing local differences.",
          title: "Regional movement",
        },
        {
          text: "Sectoral dispersion matters because manufacturing, construction, and services react differently to the same downturn.",
          title: "Different swings",
        },
      ],
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
      explanationSteps: [
        {
          text: "Modelos automatizados precisam ser avaliados por uso real, retrabalho, tempo de geração e erros documentais.",
          title: "Indicadores",
        },
        {
          text: "Aderência ao padrão mostra se o documento gerado respeita o formato jurídico esperado.",
          title: "Padrão",
        },
        {
          text: "Feedback de usuários internos ajuda a identificar onde a automação atrapalha ou melhora a rotina.",
          title: "Feedback interno",
        },
      ],
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
      explanationSteps: [
        {
          text: "COVID-19 spread through transmission chains that forced public health teams to reduce contact and protect hospitals.",
          title: "Transmission pressure",
        },
        {
          text: "Non-pharmaceutical interventions, vaccine procurement, and hospital capacity shaped the crisis response.",
          title: "Response tools",
        },
        {
          text: "Denialism and federal-state conflict changed how mortality, restrictions, and vaccination played out in Brazil.",
          title: "Governance conflict",
        },
      ],
      language: "en",
      lessonDescription:
        "The main epidemiological and political dimensions of the COVID-19 crisis in Brazil. These concepts track transmission control, system strain, vaccination, denialism, and intergovernmental conflict.",
      topic: "COVID-19 Crisis and Pandemic Governance",
    },
  },
];
