const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: The explanation must be technically correct for the topic. Penalize invented mechanisms, wrong cause-effect chains, or misleading simplifications.

2. REQUIRED STRUCTURE: The output must contain:
   - initialQuestion { question, visual, explanation }
   - scenario { title, text }
   - concepts[] with title, text, visual
   - predict[] with exactly 2 checks
   - anchor { title, text }

3. HOOK QUALITY: initialQuestion should create curiosity before teaching. Penalize dry definitions, obvious trivia questions, or hooks that already explain the answer.

4. SCENARIO QUALITY: scenario.text must open inside a concrete daily-life situation. Penalize domain jargon, "imagine that...", abstract framing, or scenarios that feel like an educational exercise instead of real life.

5. CONCEPT QUALITY: concepts should do the real teaching. Penalize repetition, vague filler, or concept texts that stay so shallow the learner only gets a slogan.

6. VISUAL QUALITY: initialQuestion.visual is required and must be an instructional visual brief, not decorative art. concept visuals should appear only when they clarify something. Penalize vague visuals, decorative visuals, or visuals that do not help explain the concept.

7. PREDICT QUALITY: predict checks should reinforce understanding, not act like tricky exams. Penalize gotcha wording, obviously silly distractors, generic feedback, or checks that are disconnected from nearby concepts. Feedback must add real explanatory value: penalize feedback that only says the learner is right/wrong, merely paraphrases the chosen option, or fails to explain the reasoning behind the answer. The first check should land around the middle of concepts, and the second should land after the final concept via the concept title reference.

8. ANCHOR QUALITY: anchor must tie back to a real product, system, or daily behavior. Penalize abstract "this matters" endings, metaphors, or fake/non-concrete examples.

9. STYLE: Keep every section short, distinct, and readable. Penalize long paragraphs, heavy redundancy, academic tone, or repeated explanations across hook, scenario, concepts, and anchor.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require a fixed number of concepts. Some topics need fewer, some need more
- Do NOT penalize for omitting concept visuals when the explanation is already clear without them
- Do NOT require specific title wording, specific real-world products, or a specific visual kind
- Do NOT penalize for creative daily-life scenarios if they stay concrete and jargon-free
- Do NOT focus on JSON wrapping or formatting trivia. Evaluate the content and structural fit
- ONLY penalize for: wrong structure, factual errors, weak hook/scenario/anchor design, vague or decorative visuals, shallow concept teaching, bad predict checks, redundancy, or breaking the writing constraints
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
      chapterTitle: "Networking fundamentals",
      concept: "Encapsulation",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "How network data gets wrapped with layer-specific information so different parts of the network know what to do with it.",
      lessonTitle: "Encapsulation",
      neighboringConcepts: [
        "DNS Resolution",
        "TCP Handshake",
        "Hop-by-Hop Forwarding",
        "Packet Fragmentation",
      ],
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
      chapterTitle: "Tipos numéricos e valores especiais",
      concept: "Float e bool como tipos numéricos",
      courseTitle: "Python",
      language: "pt",
      lessonDescription:
        "Como floats representam números com casas decimais e como bool se encaixa na hierarquia numérica do Python.",
      lessonTitle: "Float e bool como tipos numéricos",
      neighboringConcepts: [
        "Conversão de Tipos",
        "Operadores Aritméticos",
        "Comparação de Valores",
        "Booleanos como Inteiros",
      ],
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
      chapterTitle: "Carbonilos y enolatos",
      concept: "Acidez en posición alfa",
      courseTitle: "Química",
      language: "es",
      lessonDescription:
        "Por qué ciertos hidrógenos junto al carbonilo salen con más facilidad y cómo eso forma un enolato útil para construir enlaces C-C.",
      lessonTitle: "Acidez en posición alfa",
      neighboringConcepts: [
        "Adición nucleofílica",
        "Estabilización por resonancia",
        "Enolato como nucleófilo",
        "Condensación aldólica",
      ],
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
      chapterTitle: "Business cycles",
      concept: "Labor market aggregates over the cycle",
      courseTitle: "Economics",
      language: "en",
      lessonDescription:
        "How employment, unemployment, hours, and participation move during booms and downturns, including important timing differences.",
      lessonTitle: "Labor market aggregates over the cycle",
      neighboringConcepts: [
        "GDP Growth Rate",
        "Inflation Targeting",
        "Hours Worked",
        "Labor Force Participation",
      ],
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
      chapterTitle: "Legal tech e automação documental",
      concept: "Métricas de qualidade documental",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Como acompanhar qualidade, consistência e rastreabilidade na automação de documentos jurídicos.",
      lessonTitle: "Métricas de qualidade documental",
      neighboringConcepts: [
        "Templates Jurídicos",
        "Assinatura Digital",
        "Rastros de Auditoria",
        "Classificação de Erros",
      ],
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
      chapterTitle: "Networking fundamentals",
      concept: "Layer-by-layer isolation",
      courseTitle: "Web Development",
      language: "en",
      lessonDescription:
        "A practical mental model for narrowing connectivity problems by checking one layer of the path at a time.",
      lessonTitle: "Layer-by-layer isolation",
      neighboringConcepts: [
        "Latency Measurement",
        "Network Address Translation",
        "Gateway Reachability",
        "Service-Layer Diagnosis",
      ],
    },
  },
];
