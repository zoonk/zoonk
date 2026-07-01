import { type LessonPracticeParams } from "@zoonk/ai/tasks/lessons/core/practice";

const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. REAL-LIFE APPLICATIONS: The practice must be a collection of concrete situations where the source lesson concept affects an outcome that would matter outside a lesson. Penalize meta-situations where the learner is preparing teaching material, fixing educational labels, sorting classroom examples, making a poster, building a classroom demo, writing a summary, or choosing wording about the concept.

2. CLEAR CONCEPT APPLICATION: Every situation should include a clear concept clue, named concept, defining feature, mechanism, rule, measurement, or real observation. The question should ask the learner to apply that concept to choose an action, explanation, classification, prediction, check, or consequence. Do not penalize a situation for naming the concept or giving the definition when the learner still has to use it.

3. NOT MEMORIZATION: Penalize direct definition drills such as "What is X?", "Which option is the definition of X?", or "Is X category A or B?" when detached from a concrete situation. A good item can give a definition clue and ask what it implies in a real problem, such as "cells without a nucleus -> likely bacteria" or "photosynthesis problem -> change light conditions."

4. NO HIDDEN-CONCEPT PUZZLES: Penalize outputs that hide the concept behind abstract clues, convoluted case-file details, or mystery-style deduction. The learner should know which idea is relevant and be tested on whether they can use it, not on whether they can guess the hidden topic from option shape.

5. FOCUSED SITUATION SET: Situations do not need to share a story, character, artifact, or final reveal. Penalize forced storytelling, escalating logistics, recurring plots that make the lesson harder to follow, and broad operational decisions where the source concept gets buried.

6. VISUAL GROUNDING: Every situation should include an imagePrompt that gives useful evidence, not decoration. The image should help the learner reason through a concrete object, organism, screen, report, sample, behavior, measurement, label, diagram, or visible state. Penalize generic image prompts that add no value.

7. DIALOGUE QUALITY: Dialogue must be pure conversation with no narrator text, speaker labels, stage directions, colons before quoted speech, or surrounding quotation marks. A single person speaking directly to {{NAME}} is valid. Dialogue should introduce the concrete situation, useful clue, or practical reason the choice matters. Penalize dialogue that duplicates the question, gives away the answer, uses the correct option text or a close paraphrase, reads like a lecture, or turns into a story recap. If the question asks for a classification, action, cause, or conclusion, dialogue must not state that classification, action, cause, or conclusion before the learner answers.

8. TONE: Clarity comes first. Light humor is allowed only when it is minimal and does not carry or hide the clue. Penalize joke-first situations, punchline dialogue, or all-silly distractor sets.

9. FORMAT COMPLIANCE: Verify these constraints:
   - Output has a situations array
   - Output does not include a top-level scenario, scenario title, scenario text, intro step, or opening image
   - every situation has: imagePrompt, dialogue, question, options
   - each situation is understandable without reading another situation
   - question should be short, direct, not already asked inside dialogue, and grounded in the situation
   - option text should usually be short and easy to scan; terse options are fine when the question and situation make them unambiguous
   - bare concept labels are allowed when the situation makes the label an applied choice, not a vocabulary drill
   - dialogue gives evidence for the correct option, not the correct option text itself
   - Exactly 1 option must have isCorrect: true

10. PERSONALIZATION: The {{NAME}} placeholder should be used appropriately in dialogue only and sparingly. Penalize {{NAME}} in image prompts, questions, options, or feedback. Penalize outputs that put {{NAME}} in every dialogue or make most dialogue lines start with {{NAME}}; one or two natural uses in a practice lesson is enough.

11. FEEDBACK QUALITY: Each option must explain why it is right or wrong in this exact situation. Wrong-answer feedback should name the misconception or missing condition and state the better answer. Penalize generic score-report feedback.

12. DISTRACTOR QUALITY: All wrong options must be plausible choices someone might consider for this exact situation. Penalize absurd, joke-shaped, random, or obviously irrelevant options. Penalize answer sets where the correct option is guessable because every distractor is on a different axis or obviously impossible.

13. SITUATION COUNT: Practice should use as many situations as the lesson concepts need, and no more. The right count depends on the lesson. Penalize outputs that skip important lesson concepts, and penalize padded, repetitive, or same-question-with-new-prop situations.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require one story, one setting, one character, or one recurring case
- Do NOT penalize independent situations just because they are disconnected from each other
- Do NOT require a plot twist, final reveal, or narrative resolution
- Do NOT penalize a valid real-world situation just because it is not the situation you would have chosen
- Do NOT penalize concept names or definition clues when the learner must apply them to a concrete situation
- Do NOT penalize a small overrun on text length if the situation is still fast, clear, and readable on the first pass
- Do NOT require humor
- Do NOT penalize dialogue just because one person speaks to {{NAME}} instead of alternating turns; penalize only if it stops sounding like direct speech or removes the learner's application
- Do NOT require every dialogue to address the learner by name; most dialogue lines should work without {{NAME}}
- Do NOT penalize terse option text by itself; penalize it only when it becomes vague, purely vocabulary-based, or answerable without the situation evidence
- Do penalize direct definition/function/role/process questions when the learner can answer without using a real situation
- Do penalize dialogue that says the correct option or direct answer before asking the learner to choose it
- Do penalize repetitive {{NAME}} usage across every dialogue
- Do penalize situations where the concept is hidden so deeply that the learner is solving a riddle instead of applying an idea
- Do penalize situations where the learner can guess the answer by eliminating absurd distractors without understanding the concept
- Do penalize generic decoration image prompts
- Do penalize prompt residue, narrator text in dialogue, duplicated dialogue questions, forced storytelling, repetitive/filler decisions, all-silly distractor sets, poor distractor quality, and factually incorrect lesson application
- Different valid practice approaches exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Energy and matter flow must be biologically accurate at a simple introductory level. Penalize if:
   - Light is treated as matter or as food by itself
   - Producers are described as eating soil, light, or ready sugar from the environment
   - Fungi or similar heterotrophs are described as photosynthesizing in the dark
   - Organic matter, biological work, and residues are not connected inside the situations that test them

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-energia-atividade-vital",
    userInput: {
      chapterTitle: "Características dos seres vivos",
      courseTitle: "Biologia",
      language: "pt",
      lesson: {
        description:
          "Relacione metabolismo, obtenção de matéria, obtenção de energia, trabalho biológico e eliminação de resíduos. O aluno diferencia produtores, consumidores e decompositores em exemplos simples sem tratar luz como alimento ou matéria.",
        title: "Metabolismo, energia e matéria",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: URL decisions must preserve the browser-facing meaning of each part. Penalize if:
   - Scheme, domain, path, query, or fragment are swapped or treated as interchangeable
   - A fragment is described as causing a new network request by default
   - Query parameters are treated as page path segments instead of extra instructions or filters

2. SITUATION CHECK: Situations should involve real browser, product, support, analytics, routing, or link-sharing problems where one character changes the destination, filtered result, or on-page position. Penalize classroom URL labeling, poster cleanup, or generic definitions detached from a concrete broken link.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-design-url-parts",
    userInput: {
      chapterTitle: "URLs, HTTP, and browser navigation",
      courseTitle: "Web Design",
      language: "en",
      lesson: {
        description:
          "Identify the scheme, domain, path, query string, and fragment in a URL. Predict how each part changes the browser destination, filtered result, network request, or on-page position.",
        title: "URL structure: scheme, domain, path, query, and fragment",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Sample-space reasoning must be mathematically sound. Penalize if:
   - Outcomes are missing, duplicated, or allowed to overlap
   - Events are confused with the complete sample space
   - Visual arrangement or label style changes the counted outcomes without a real change in the trial

2. SITUATION CHECK: Situations should involve practical uncertainty decisions, such as checking a simulation, game rule, experiment design, risk table, or random draw setup. Penalize outputs that only ask the learner to recite what a sample space is.

${SHARED_EXPECTATIONS}
    `,
    id: "en-probability-sample-space",
    userInput: {
      chapterTitle: "Outcomes, events, and the probability scale",
      courseTitle: "Probability",
      language: "en",
      lesson: {
        description:
          "Build a sample space by listing every possible outcome exactly once. Check simple trials for missing outcomes, duplicated outcomes, and overlapping labels before defining events.",
        title: "Sample spaces and mutually exclusive outcomes",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Mechanical-wave reasoning must keep the wave and medium distinct. Penalize if:
   - The medium is said to travel all the way with the wave
   - A mechanical wave is shown moving through empty space without matter
   - Rope, spring, air, water, and ground examples are treated as decorative rather than the material carrying the disturbance

2. SITUATION CHECK: Situations should make the learner use evidence from a rope, spring, sound, water, vibration, or ground-motion situation to decide what carries the disturbance or why a measurement failed.

${SHARED_EXPECTATIONS}
    `,
    id: "en-mechanical-waves-medium",
    userInput: {
      chapterTitle: "Mechanical waves and media",
      courseTitle: "Mechanical Waves",
      language: "en",
      lesson: {
        description:
          "Identify the medium that carries a mechanical wave, such as rope, spring, air, water, or ground. Explain why the disturbance travels through matter while the medium itself only oscillates locally.",
        title: "Mechanical wave media",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Public-money flow must stay legally and financially accurate. Penalize if:
   - Receita, orçamento, caixa, despesa, and registros patrimoniais are collapsed into one generic "money account"
   - Spending is treated as valid just because the purpose seems good, without the path through authorization and records
   - Public money is described like private cash with no accountability trail

2. SITUATION CHECK: Situations should involve tracing a real public value through records, authorization, payment, delivery, audit, or accountability. Penalize broad civics summaries or items that only define budget terms.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-financeiro-dinheiro-publico",
    userInput: {
      chapterTitle: "Direito financeiro",
      courseTitle: "Direito Financeiro",
      language: "pt",
      lesson: {
        description:
          "Acompanhe recursos públicos desde receita, orçamento e caixa até despesa, pagamento, entrega e registros patrimoniais. O aluno diferencia autorização orçamentária, fluxo financeiro e prestação de contas.",
        title: "Receita, orçamento, despesa e controle público",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Brush-cutter part compatibility must use the physical fit clues in the lesson. Penalize if:
   - Diameter, blade hole, thread, spline, handedness, or mounting position are ignored
   - Any part is treated as compatible because it has a similar name or looks close enough
   - The practice skips the purchase-risk consequence of ordering the wrong replacement

2. SITUATION CHECK: Situations should involve identifying or buying a replacement part from measurements, photos, packaging, a manual, or a damaged machine. Penalize outputs that turn the lesson into a vocabulary tour of parts.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-rocadeira-encaixes-pecas",
    userInput: {
      chapterTitle: "Componentes e encaixes da roçadeira",
      courseTitle: "Manutenção de Roçadeira",
      language: "pt",
      lesson: {
        description:
          "Leia medidas e encaixes de peças de roçadeira: diâmetro do tubo, furo da lâmina, rosca, estrias, lado de montagem e posição de fixação. O aluno confere compatibilidade antes de comprar uma peça de reposição.",
        title: "Medidas e encaixes de peças de roçadeira",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: CPA and ROAS reasoning must connect ad cost to business economics. Penalize if:
   - CPA is judged without ticket médio, margem, closing rate, or lifetime value when those facts are relevant
   - ROAS is treated as automatically good without checking margin or break-even
   - Lead and purchase conversions are mixed without accounting for taxa de fechamento

2. SITUATION CHECK: Situations should involve campaign budgets, offers, margins, conversion data, or break-even decisions where the learner chooses a viable next action. Penalize generic ad-optimization advice with no numbers or economic constraint.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-google-ads-cpa-roas-margem",
    userInput: {
      chapterTitle: "Métricas de performance e economia de campanhas",
      courseTitle: "Google Ads",
      language: "pt",
      lesson: {
        description:
          "Calcule CPA e ROAS de equilíbrio usando ticket médio, margem, taxa de fechamento e valor de vida do cliente quando fizer sentido. O aluno decide se uma campanha pode escalar sem vender abaixo do ponto de equilíbrio.",
        title: "CPA, ROAS e margem de contribuição",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Attention reasoning must preserve the query-key-value mechanism. Penalize if:
   - Queries, keys, and values are treated as interchangeable labels
   - Dot-product scores, softmax weights, and blended value vectors are collapsed into one vague "attention score"
   - The output ignores scaling, masking, or the fact that each position attends from its own query when those details matter in the situation

2. SITUATION CHECK: Situations should involve real model-debugging, attention-trace, token-ranking, or inference-quality problems where the learner uses visible scores, weights, masks, or vector roles to explain an output. Penalize classroom matrix-labeling or definition recall.

${SHARED_EXPECTATIONS}
    `,
    id: "en-transformers-qkv-attention",
    userInput: {
      chapterTitle: "Attention mechanisms",
      courseTitle: "Machine Learning",
      language: "en",
      lesson: {
        description:
          "Compute scaled dot-product attention with queries, keys, values, attention scores, softmax weights, masks, and blended value vectors. Trace which tokens matter most to one position and why each position attends from its own query.",
        title: "Scaled dot-product attention with Q, K, and V",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Mutation-effect reasoning must stay precise from DNA change to protein consequence. Penalize if:
   - Every mutation is treated as harmful or guaranteed to change the observable trait
   - Silent, missense, nonsense, insertion, deletion, and frameshift effects are mixed up
   - Insertions or deletions are described without checking whether the reading frame changes

2. SITUATION CHECK: Situations should involve sequence reports, variant reviews, codon tables, protein notes, or lab decisions where the learner predicts the likely molecular consequence from evidence. Penalize generic mutation vocabulary drills with no sequence or codon reasoning.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-mutacao-mensagem",
    userInput: {
      chapterTitle: "Mutações, recombinação e regulação gênica",
      courseTitle: "Biologia",
      language: "pt",
      lesson: {
        description:
          "Analise substituições, inserções e deleções no DNA e preveja efeitos sobre códons, aminoácidos e proteínas. Compare mutações silenciosas, missense, nonsense e frameshift usando o quadro de leitura.",
        title: "Tipos de mutação e efeitos no quadro de leitura",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Data-source reasoning must distinguish recorded signals from assumptions. Penalize if:
   - Facts, measurements, responses, clicks, photos, texts, or logs are called data without checking what was actually captured
   - Unrecorded context is treated as if it were in the dataset
   - The model skips the loss that happens when reality becomes a simplified record

2. SITUATION CHECK: Situations should involve deciding what an app, form, sensor, survey, photo, log, or dataset really captured. Penalize examples where "data" is just a buzzword and no recorded evidence changes the decision.

${SHARED_EXPECTATIONS}
    `,
    id: "es-ciencia-datos-que-cuenta",
    userInput: {
      chapterTitle: "Datos, medición y registros",
      courseTitle: "Ciencia de Datos",
      language: "es",
      lesson: {
        description:
          "Distingue hechos, mediciones, respuestas, clics, fotos, textos y logs como datos cuando quedan registrados en una señal analizable. El alumno decide qué parte de una situación quedó capturada y qué parte solo fue asumida.",
        title: "Datos registrados y supuestos no observados",
      },
    } satisfies LessonPracticeParams,
  },
];
