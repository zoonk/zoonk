const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: The explanation must be technically correct for the topic. Penalize invented mechanisms, wrong cause-effect chains, or misleading simplifications.

2. REQUIRED STRUCTURE: The output must contain exactly three top-level fields:
   - explanation[]: an array of narrative steps, each with title, text, and visual
   - predict[]: exactly 2 quick checks, each with step (matching an explanation title), question, options
   - anchor: { title, text } (no visual)

3. GOAL DELIVERY: The activity must actually deliver on ACTIVITY_GOAL. The learner should finish the activity knowing what the thing is, why it exists or is used (when the goal implies it), and how it works or is written in practice (when the goal implies it). Penalize activities that stay surface-level and leave the learner still unsure what the thing is, why it matters, or how it's written when the goal required these.

4. SCENE SPINE: The entire activity must revolve around ONE concrete moment (e.g. tapping a button, sending a message, opening a contact list). Every step refers back to or deepens that same moment. The single scene is the vehicle for covering what/why/how when the goal requires all three. Penalize:
   - Activities that jump between multiple unrelated scenarios
   - An opening scenario that gets abandoned after step 1
   - Definitions that float in abstractly instead of pointing at something already shown in the scene

5. COLD OPEN: Step 1 must land the learner inside a concrete sensory moment with no question-as-hook, no "Imagine...", no resolution, and no definition. Penalize steps that answer their own setup within the same step, or that open with abstract framing.

6. NARRATIVE ARC: The explanation[] array should unfold a clear arc: cold open → mystery (something hidden) → reveal (what was hidden) → naming (from inside the scene) → zoom (into one piece, often "how") → optional stakes (why, when the goal calls for it) → payoff (callback to the opening). Step count is flexible — deeper topics need more steps, simpler topics fewer — but these narrative functions should be present in order. Penalize:
   - A structure that reads as stacked definitions rather than a single unfolding story
   - Missing a payoff/callback as the last step
   - Naming a term before showing an example of it in the scene

7. STEP QUALITY: Each step.text is 1–3 short sentences of prose. Step titles are short (1–3 words), narrative markers (not textbook section headers), and unique within the activity. Penalize:
   - Long paragraphs
   - Titles like "Programa", "Instrução", "Encapsulation" that sound like chapter headers
   - Repetition between steps

8. VISUAL QUALITY: Every explanation step has a visual, and each visual must advance the narrative — showing the scene, revealing hidden structure, zooming in, or showing a contrast/callback. When the goal includes "how it's written", code or structural visuals should appear at the reveal or zoom moment. Penalize:
   - Decorative art or generic concept illustrations
   - Visuals that only restate what the text already said
   - Missing visuals on explanation steps
   - Missing a code/structural visual when the goal calls for showing how the thing is written

9. PREDICT QUALITY: Exactly 2 checks. Predict #1 lands after a mystery step, before the reveal (commit-before-reveal). Predict #2 lands after the zoom, before the payoff (raise-stakes-before-callback). Each predict.step must exactly match an existing explanation title. Feedback must teach — after reading feedback alone, the learner should better understand the concept. Penalize:
   - Checks placed outside these two slots (e.g., after the payoff)
   - step fields that don't match any explanation title
   - Gotcha wording, silly distractors, or feedback that only says "correct/incorrect" without teaching the reasoning

10. ANCHOR QUALITY: anchor has no visual. It callbacks the opening scene or generalizes it ("every time you do X"), referencing a real product, system, or daily behavior. Penalize:
   - Abstract "this is why it matters" wrap-ups
   - Brand new scenarios unrelated to the opening
   - Metaphors or vague generalities

11. STYLE: Clear, short, concrete, beginner-friendly. Penalize academic tone, filler lines, and redundancy across steps and anchor.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require a fixed number of steps. Complex topics need more; simple topics fewer. Both are fine as long as the arc is present and the goal is delivered
- Do NOT require specific title wording, specific real-world products, or a specific visual kind
- Do NOT penalize creative scenes as long as they stay concrete and the same scene threads through every step
- Do NOT focus on JSON wrapping or formatting trivia. Evaluate the content and structural fit
- ONLY penalize for: wrong top-level structure, factual errors, failing to deliver ACTIVITY_GOAL, broken scene continuity, weak cold open, missing arc, bad visuals, misplaced or weak predict checks, anchor drift, or broken writing constraints
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Encapsulation is about wrapping data with protocol-specific headers as it moves through layers. Penalize if:
   - Encapsulation is confused with encryption
   - It implies routers see the whole application message unchanged at every stage

2. DEPTH CHECK: Penalize if the concepts reduce everything to "data goes from A to B" without showing that each layer adds structure for a different job.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-encapsulation",
    userInput: {
      activityGoal:
        "explain how data gains layer-specific headers as it moves through the network and why each layer needs different information",
      activityTitle: "Encapsulation",
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      language: "en",
      lessonConcepts: [
        "Encapsulation",
        "DNS Resolution",
        "TCP Handshake",
        "Hop-by-Hop Forwarding",
        "Packet Fragmentation",
      ],
      lessonDescription:
        "How network data gets wrapped with layer-specific information so different parts of the network know what to do with it.",
      lessonTitle: "Encapsulation",
      otherActivityTitles: [],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Python numeric types have a specific relationship. Penalize if:
   - bool is treated as unrelated to int
   - floating-point numbers are described as exact decimal storage

2. DEPTH CHECK: Penalize if the explanation only says "float has decimals and bool is true/false" without addressing representation or the bool-int relationship.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-float-bool",
    userInput: {
      activityGoal:
        "comparar como float e bool funcionam como tipos numéricos em Python e explicar os limites de cada representação",
      activityTitle: "Float e bool como tipos numéricos",
      chapterTitle: "Tipos numéricos e valores especiais",
      courseTitle: "Python",
      language: "pt",
      lessonConcepts: [
        "Float e bool como tipos numéricos",
        "Conversão de Tipos",
        "Operadores Aritméticos",
        "Comparação de Valores",
        "Booleanos como Inteiros",
      ],
      lessonDescription:
        "Como floats representam números com casas decimais e como bool se encaixa na hierarquia numérica do Python.",
      lessonTitle: "Float e bool como tipos numéricos",
      otherActivityTitles: [],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Enolate chemistry depends on resonance-stabilized nucleophiles. Penalize if:
   - The enolate is described as an electrophile
   - The alpha position is explained only through inductive effects

2. DEPTH CHECK: Penalize if the concepts never explain why the alpha hydrogen is unusually acidic or what the resulting enolate can do.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-enolatos",
    userInput: {
      activityGoal:
        "explicar por qué el hidrógeno alfa junto al carbonilo sale con más facilidad y cómo eso forma un enolato útil",
      activityTitle: "Acidez en posición alfa",
      chapterTitle: "Carbonilos y enolatos",
      courseTitle: "Química",
      language: "es",
      lessonConcepts: [
        "Acidez en posición alfa",
        "Adición nucleofílica",
        "Estabilización por resonancia",
        "Enolato como nucleófilo",
        "Condensación aldólica",
      ],
      lessonDescription:
        "Por qué ciertos hidrógenos junto al carbonilo salen con más facilidad y cómo eso forma un enolato útil para construir enlaces C-C.",
      lessonTitle: "Acidez en posición alfa",
      otherActivityTitles: [],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Labor-market indicators react differently over the business cycle. Penalize if:
   - Unemployment is treated as moving instantly with GDP
   - Participation is described as always moving in the same direction for the same reason

2. DEPTH CHECK: Penalize if the concepts collapse the topic into "recession means job loss" without explaining the different aggregates and lags.

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-labor-aggregates",
    userInput: {
      activityGoal:
        "compare how employment, unemployment, hours, and participation move over the business cycle and why they do not move together",
      activityTitle: "Labor market aggregates over the cycle",
      chapterTitle: "Business cycles",
      courseTitle: "Economics",
      language: "en",
      lessonConcepts: [
        "Labor market aggregates over the cycle",
        "GDP Growth Rate",
        "Inflation Targeting",
        "Hours Worked",
        "Labor Force Participation",
      ],
      lessonDescription:
        "How employment, unemployment, hours, and participation move during booms and downturns, including important timing differences.",
      lessonTitle: "Labor market aggregates over the cycle",
      otherActivityTitles: [],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Document automation monitoring in legal tech should stay tied to quality and auditability. Penalize if:
   - Metrics are framed only as speed or cost
   - Audit trails are ignored when talking about quality control

2. DEPTH CHECK: Penalize if the concepts never identify what is being measured or why those measurements matter for safety and review.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-legaltech-quality-metrics",
    userInput: {
      activityGoal:
        "identificar quais métricas mostram a qualidade documental e explicar como elas ajudam na revisão e na rastreabilidade",
      activityTitle: "Métricas de qualidade documental",
      chapterTitle: "Legal tech e automação documental",
      courseTitle: "Direito",
      language: "pt",
      lessonConcepts: [
        "Métricas de qualidade documental",
        "Templates Jurídicos",
        "Assinatura Digital",
        "Rastros de Auditoria",
        "Classificação de Erros",
      ],
      lessonDescription:
        "Como acompanhar qualidade, consistência e rastreabilidade na automação de documentos jurídicos.",
      lessonTitle: "Métricas de qualidade documental",
      otherActivityTitles: [],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Layer-by-layer isolation is a debugging method for narrowing where connectivity breaks. Penalize if:
   - It turns into a list of tool commands instead of a reasoning model
   - It implies you should start with the application and guess downward

2. DEPTH CHECK: Penalize if the concepts never separate host, subnet, gateway, path, and service-level possibilities.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-layer-isolation",
    userInput: {
      activityGoal:
        "narrow a connectivity problem by checking one layer of the path at a time instead of guessing everywhere at once",
      activityTitle: "Layer-by-layer isolation",
      chapterTitle: "Networking fundamentals",
      courseTitle: "Web Development",
      language: "en",
      lessonConcepts: [
        "Layer-by-layer isolation",
        "Latency Measurement",
        "Network Address Translation",
        "Gateway Reachability",
        "Service-Layer Diagnosis",
      ],
      lessonDescription:
        "A practical mental model for narrowing connectivity problems by checking one layer of the path at a time.",
      lessonTitle: "Layer-by-layer isolation",
      otherActivityTitles: [],
    },
  },
];
