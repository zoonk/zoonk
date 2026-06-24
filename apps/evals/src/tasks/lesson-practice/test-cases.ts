import { type LessonPracticeParams } from "@zoonk/ai/tasks/lessons/core/practice";

const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. REAL CASE: The practice must be one concrete case where the lesson concept affects an outcome that would matter outside a lesson. Penalize meta-scenarios where the learner is preparing teaching material, fixing labels, sorting examples, making a poster, building a classroom demo, writing a summary, or choosing wording about the concept.

2. MECHANISM TRANSFER: Every scene should start from an observable effect, symptom, behavior, failed output, mismatch, trace, record, measurement, or visible state. The question should ask the learner to infer a cause, failure point, next check, best comparison, or best action. Penalize questions that can be answered by recalling a definition, function, role, or process label without reasoning from the scene.

3. CONCEPT COVERAGE WITHOUT A CONCEPT TOUR: The practice should cover all lesson concepts implied by the lesson metadata through distinct effects or failure modes in the same case. Penalize outputs that skip important concepts, but also penalize outputs that become a tour of vocabulary, roles, or processes even if each individual scene is accurate.

4. STORY CONTINUITY: Scenes must flow through one case. Each scene should add useful evidence, narrow the diagnosis, change the decision, or reveal a consequence. Penalize disconnected examples that only share a topic.

5. VISUAL GROUNDING: Every scenario and every scene should include an imagePrompt that gives useful evidence, not decoration. The image should help the learner reason about the decision through an artifact, screen, diagram, label, table, document, measurement, sample, behavior, or concrete scene clue. Penalize generic image prompts that add no value.

6. DIALOGUE QUALITY: Dialogue must be pure conversation with no narrator text, speaker labels, stage directions, colons before quoted speech, or surrounding quotation marks. A single colleague speaking directly to {{NAME}} is valid for this schema; do not require a scripted back-and-forth exchange. Dialogue should sound like something a real colleague would say while working the case: it gives evidence, tension, or uncertainty, while the separate question field asks the learner-facing decision. Penalize dialogue that duplicates the question, gives away the inferred cause/action, or reads like a lecture, narrator summary, or formal briefing instead of direct speech.

7. TONE: Light humor is good. Strong humor usually appears as a concrete comparison or analogy that keeps the case clear. Penalize humor that hides the clue, turns the whole scene into the joke, or makes all distractors silly. Do not penalize one playful or silly distractor when the other wrong options are plausible and the scene still tests reasoning.

8. FORMAT COMPLIANCE: Verify these constraints:
   - scenario has: title, text, imagePrompt
   - scenario.title should feel like a short, memorable practical case title, not a generic label or a copied source lesson title
   - every scene has: imagePrompt, dialogue, question, options
   - scenario.text is short, clear on the first read, and written as scenario setup rather than first-person narration
   - scenario.text sets the stage, gives the learner a concrete task, and explains why the outcome matters in the scenario
   - question should be short, direct, not already asked inside dialogue, and grounded in an observable effect from the scene
   - option text should usually be short and easy to scan; terse options are fine when the question and scene make them unambiguous
   - prefer causes, next actions, failure points, or comparisons over bare vocabulary labels, but do not penalize a short label when it is a real case decision and all options are at the same level
   - Exactly 1 option must have isCorrect: true
   - The recurring person or situation introduced in scenario.text should stay consistent across the dialogue unless the story deliberately reveals a reason for the change
   - Do NOT penalize for output being wrapped in {"scenes": [...]} vs a raw array - both are valid formats

9. PERSONALIZATION: The {{NAME}} placeholder should be used appropriately in dialogue or feedback to personalize the experience.

10. FEEDBACK QUALITY: Each option must explain why it is right or wrong in this exact scene. Wrong-answer feedback should name what is misleading and state the better answer. Penalize generic score-report feedback.

11. DISTRACTOR QUALITY: All wrong options must be plausible choices someone might consider for this exact decision. Penalize absurd, joke-shaped, random, or obviously irrelevant options, including details from the general scenario that do not belong to the current compatibility, diagnosis, calculation, or evidence decision.

12. SCENE COUNT: Practice should use as many scenes as the lesson concepts need, and no more. The right count depends on the lesson. Penalize outputs that skip important lesson concepts, and penalize padded, repetitive, or same-question-with-new-prop scenes.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific plot choices, character names, or scenario settings you might expect
- Do NOT require one exact plot, character, setting, or sample set
- Do NOT penalize a valid real-world scenario just because it is not the scenario you would have chosen
- Do NOT require a plot twist; a reveal is optional and should only be used when it naturally changes the diagnosis or explains earlier clues
- Do NOT penalize for output being wrapped in {"scenes": [...]} instead of a raw array
- Do NOT penalize a small overrun on text length if the scene is still fast, clear, and readable on the first pass
- Do NOT penalize light humor, a playful tone, or slightly silly moments when they still sound natural, scene-appropriate, and clear
- Do NOT require every dialogue line to contain a joke; clarity comes first
- Do NOT penalize dialogue just because one colleague speaks to {{NAME}} instead of alternating turns; penalize only if it stops sounding like direct workplace speech or removes the learner's inference
- Do NOT penalize terse option text by itself; penalize it only when it becomes vague, purely vocabulary-based, or answerable without the scene evidence
- Do NOT penalize a single playful or silly option when the rest of the distractors remain plausible
- Do penalize direct definition/function/role/process questions when the learner can answer without using the case evidence
- Do penalize scenes where the concept is merely named instead of shown through an effect
- Do penalize generic decoration image prompts
- Do penalize prompt residue, narrator text in dialogue, duplicated dialogue questions, disconnected scene flow, repetitive/filler decisions, all-silly distractor sets, poor distractor quality, and factually incorrect lesson application
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
   - Organic matter, biological work, and residues are not connected to the same case

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-energia-atividade-vital",
    userInput: {
      chapterTitle: "O que conta como vida",
      courseTitle: "Biologia",
      language: "pt",
      lesson: {
        description:
          "Trace como um ser vivo obtém energia e matéria, transforma isso em trabalho biológico e elimina resíduos. Você vai diferenciar, em nível simples, organismos que produzem seu próprio alimento dos que precisam consumir ou absorver matéria orgânica.",
        title: "Siga energia virando atividade vital",
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

2. SCENARIO CHECK: The case should involve a real browser, product, support, analytics, routing, or link-sharing problem where one character changes the destination, filtered result, or on-page position. Penalize classroom URL labeling, poster cleanup, or generic definitions detached from a concrete broken link.

${SHARED_EXPECTATIONS}
    `,
    id: "en-web-design-url-parts",
    userInput: {
      chapterTitle: "How a website shows up in a browser",
      courseTitle: "Web Design",
      language: "en",
      lesson: {
        description:
          "Read the parts of a URL—scheme, domain, path, query, and fragment—and predict what each part tells the browser to do. You’ll see why changing one character can mean a different page, a filtered result, or no network request at all.",
        title: "Read a URL like a browser",
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

2. SCENARIO CHECK: The case should involve a practical uncertainty decision, such as checking a simulation, game rule, experiment design, risk table, or random draw setup. Penalize outputs that only ask the learner to recite what a sample space is.

${SHARED_EXPECTATIONS}
    `,
    id: "en-probability-sample-space",
    userInput: {
      chapterTitle: "Outcomes, events, and the probability scale",
      courseTitle: "Probability",
      language: "en",
      lesson: {
        description:
          "Build a sample space by listing every result that could happen, with no result fitting in two places at once. Check simple examples for missing outcomes and overlapping labels.",
        title: "List a clean sample space",
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

2. SCENARIO CHECK: The case should make the learner use evidence from a rope, spring, sound, water, vibration, or ground-motion situation to decide what carries the disturbance or why a measurement failed.

${SHARED_EXPECTATIONS}
    `,
    id: "en-mechanical-waves-medium",
    userInput: {
      chapterTitle: "Disturbances that move through matter",
      courseTitle: "Mechanical Waves",
      language: "en",
      lesson: {
        description:
          "Identify the material that carries a mechanical wave: rope, spring, air, water, or ground. Decide why the wave needs matter to move through, even when that matter does not travel all the way with the wave.",
        title: "Spot the medium carrying the wave",
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

2. SCENARIO CHECK: The case should involve tracing a real public value through records, authorization, payment, delivery, audit, or accountability. Penalize broad civics summaries or scenes that only define budget terms.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-financeiro-dinheiro-publico",
    userInput: {
      chapterTitle: "O caminho do dinheiro público",
      courseTitle: "Direito Financeiro",
      language: "pt",
      lesson: {
        description:
          "Acompanhe um valor desde a entrada no Estado até a entrega de um serviço, uma obra, um salário ou um benefício. Você vai reconhecer que o caminho passa por receita, orçamento, caixa, despesa e registros patrimoniais, sem tratar tudo como “dinheiro na conta”.",
        title: "Seguir um real dentro do Estado",
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

2. SCENARIO CHECK: The case should involve identifying or buying a replacement part from measurements, photos, packaging, a manual, or a damaged machine. Penalize outputs that turn the lesson into a vocabulary tour of parts.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-rocadeira-encaixes-pecas",
    userInput: {
      chapterTitle: "A roçadeira por fora e por dentro",
      courseTitle: "Manutenção de Roçadeira",
      language: "pt",
      lesson: {
        description:
          "Leia medidas e encaixes comuns: diâmetro do tubo, furo da lâmina, rosca, estrias, lado direito ou esquerdo e posição de montagem. Use esse vocabulário para conferir compatibilidade antes de comprar uma peça.",
        title: "Descrever encaixes para pedir peças",
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

2. SCENARIO CHECK: The case should involve a campaign budget, offer, margin, conversion data, or break-even decision where the learner chooses a viable next action. Penalize generic ad-optimization advice with no numbers or economic constraint.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-google-ads-cpa-roas-margem",
    userInput: {
      chapterTitle: "Metas de negócio que viram campanhas",
      courseTitle: "Google Ads",
      language: "pt",
      lesson: {
        description:
          "Calcule quanto uma conversão pode custar usando ticket médio, margem, taxa de fechamento e valor de vida do cliente quando fizer sentido. Isso permite estimar CPA ou ROAS de equilíbrio antes de gastar orçamento.",
        title: "Usar margem para definir CPA e ROAS viáveis",
      },
    } satisfies LessonPracticeParams,
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Attention reasoning must preserve the query-key-value mechanism. Penalize if:
   - Queries, keys, and values are treated as interchangeable labels
   - Dot-product scores, softmax weights, and blended value vectors are collapsed into one vague "attention score"
   - The output ignores scaling, masking, or the fact that each position attends from its own query when those details matter in the scene

2. SCENARIO CHECK: The case should involve a real model-debugging, attention-trace, token-ranking, or inference-quality problem where the learner uses visible scores, weights, masks, or vector roles to explain an output. Penalize classroom matrix-labeling or definition recall.

${SHARED_EXPECTATIONS}
    `,
    id: "en-transformers-qkv-attention",
    userInput: {
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      lesson: {
        description:
          "Follow the query-key-value calculation behind scaled dot-product attention. Compute which tokens matter most to one position and how their value vectors are blended into a new representation.",
        title: "Computing attention with Q, K, and V",
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

2. SCENARIO CHECK: The case should involve a sequence report, variant review, codon table, protein note, or lab decision where the learner predicts the likely molecular consequence from evidence. Penalize generic mutation vocabulary drills with no sequence or codon reasoning.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-mutacao-mensagem",
    userInput: {
      chapterTitle: "Do DNA à proteína",
      courseTitle: "Biologia",
      language: "pt",
      lesson: {
        description:
          "Analise substituições, inserções e deleções no DNA e preveja como elas podem alterar códons, aminoácidos e proteínas. Compare mutações silenciosas, de sentido trocado, sem sentido e mudanças no quadro de leitura.",
        title: "Quando uma mutação muda a mensagem",
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

2. SCENARIO CHECK: The case should involve deciding what an app, form, sensor, survey, photo, log, or dataset really captured. Penalize examples where "data" is just a buzzword and no recorded evidence changes the decision.

${SHARED_EXPECTATIONS}
    `,
    id: "es-ciencia-datos-que-cuenta",
    userInput: {
      chapterTitle: "Datos que vienen del mundo real",
      courseTitle: "Ciencia de Datos",
      language: "es",
      lesson: {
        description:
          "Distingue hechos, mediciones, respuestas, clics, fotos, textos y registros como posibles datos cuando se transforman en una señal que puede analizarse. Practica decidir qué parte de una situación cotidiana sí quedó registrada y qué parte solo se asumió.",
        title: "Reconocer qué cuenta como dato",
      },
    } satisfies LessonPracticeParams,
  },
];
