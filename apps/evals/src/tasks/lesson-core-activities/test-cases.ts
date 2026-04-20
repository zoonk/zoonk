const SHARED_EXPECTATIONS = `
  EVALUATION CRITERIA:

  PRIORITY ORDER:
  - The most important checks are COMPLETE COVERAGE, NO REDUNDANCY, and PRACTICAL TITLE STYLE
  - If the plan misses important concepts, repeats the same teaching move twice, or uses dry academic titles, that is a MAJOR ERROR
  - Everything else is secondary and should usually be treated as minor or stylistic unless it is severe

  1. COMPLETE COVERAGE (MAJOR):
     - The full set of activities must cover the lesson's scope
     - Important concepts from the lesson must be represented somewhere in the plan
     - If a concept is missing entirely, that is a major error even if the titles sound good

  2. NO REDUNDANCY (MAJOR):
     - Activities should complement each other instead of repeating the same move
     - If two activities are duplicated, overlapping, or differ only by wording, that is a major error

  3. PRACTICAL TITLE STYLE (MAJOR):
     - Titles must feel learner-facing, concrete, and useful
     - Dry textbook or glossary-style titles are a major error
     - Penalize titles that just restate raw concept labels
     - Penalize generic filler such as "Introduction", "Review", "Summary", or "Key Concepts"

  4. COHERENT GROUPING:
     - Activities should group concepts into meaningful explanation chunks
     - Penalize one-title-per-concept breakdowns when concepts naturally belong together
     - Penalize disconnected titles that do not feel like part of one lesson flow

  5. RIGHT NUMBER OF ACTIVITIES:
     - Must return 1-5 explanation activities
     - The count should match lesson complexity
     - Do not create extra activities just to hit a higher number

  6. GOAL QUALITY:
     - Each activity must include a short, clear, one-sentence goal
     - Penalize vague goals like "understand the concept better"
     - Penalize broad, untestable goals that cover the whole lesson instead of that activity

  7. OUTPUT SHAPE:
     - Each activity should include only title and goal
     - Do not reward filler metadata or extra fields

  8. GOAL COMPARISON (MAJOR):
     - Read the goals side by side — goals are the per-activity takeaway
     - Collapse failure: if two goals paraphrase the same underlying takeaway (same learner action, different framing or concept labels), that is redundancy — penalize even if titles sound concrete
     - Transitive collapse failure: if one goal paraphrases what two or more other goals accomplish together (an "overview" goal shadowing its own sub-parts), that overview is filler — penalize even when it sounds concrete on its own
     - Split failure: if one goal bundles 3+ mechanically distinct operations under an umbrella phrase ("the main parts", "these techniques", listing multiple mechanisms joined by "and" / commas), that hides detail the learner needs — penalize plans that collapse distinct mechanisms into a single activity
     - Framing-as-activity failure: penalize activities whose goal describes a stance, lens, or re-interpretation rather than a mechanism or move — titles like "Seeing X on its own terms" or "Understanding X in context" are filler disguised as content
     - All failures are equally wrong. A good plan has every goal describing a distinct learner action, no goal hiding multiple distinct actions, and no goal acting as an overview of its siblings
     - Do NOT penalize higher counts when each goal describes a genuinely different operation
     - Do NOT penalize lower counts when the concepts genuinely collapse into one or two learner moves

  9. COMPLEXITY SIGNALS:
     - The activity count should respect the signals in lesson title, chapter title, and description
     - Intro signals (chapter titles like "Getting started with", "Your first", "Introduction to"; lesson titles framing a single move; descriptions promising one thing) usually mean fewer distinct takeaways
     - Do not require a specific count — use this as context for whether the number of activities matches the real complexity of the lesson
`;

export const TEST_CASES = [
  {
    expectations: `
      Titles must be in US English.
      This lesson should land at 1-2 activities. At first exposure to functions, the concepts Function Declaration, Function Call, Function Body, Function Name, and Return Statement are mutually defining — you cannot teach what a function is without also covering how to call it, where its body goes, and what it can return. Writing separate activities for "declaration" and "call" produces the same content twice because any declaration example also needs to show the call to make sense.
      Penalize plans with 3+ activities that split these concepts; they produce duplicated content under different titles.
      Avoid raw academic titles like "Function Declaration", "Function Call", or "Return Statement" as standalone activity titles.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript-turning-repeated-code",
    userInput: {
      chapterTitle: "Functions, Arrays, and Objects",
      concepts: [
        "Function Declaration",
        "Function Call",
        "Function Body",
        "Function Name",
        "Return Statement",
      ],
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Break a repeated task into a named block of code and run it when needed. These ideas make code shorter, easier to read, and easier to change later.",
      lessonTitle: "Turning repeated code into a function",
    },
  },
  {
    expectations: `
      Titles must be in US English.
      This lesson should likely land around 2-4 explanation activities.
      Avoid flattening the plan into separate glossary-style titles for "War Captivity", "Revenge Warfare", or "War Leadership".

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-warfare",
    userInput: {
      chapterTitle: "Indigenous Brazil Before Colonization",
      concepts: ["War Captivity", "Revenge Warfare", "Raiding Practices", "War Leadership"],
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Examine conflict on its own terms instead of through colonial stereotypes. Warfare often followed rules tied to honor, memory, alliance, and the taking of captives.",
      lessonTitle: "Understanding warfare beyond colonial stereotypes",
    },
  },
  {
    expectations: `
      Titles must be in Brazilian Portuguese.
      This lesson should likely land around 3-5 explanation activities.
      Avoid dry law-school headings like "Princípios Processuais", "Contraditório", or "Ampla Defesa" as standalone activity titles.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-regras-do-jogo",
    userInput: {
      chapterTitle: "Processo Civil",
      concepts: [
        "Inércia da Jurisdição",
        "Ação de Ofício",
        "Devido Processo Legal",
        "Contraditório",
        "Ampla Defesa",
        "Isonomia Processual",
      ],
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Entenda as regras básicas que dão forma ao processo civil e limitam o poder do juiz e das partes. Esse bloco ajuda a ler qualquer procedimento sem se perder no caminho.",
      lessonTitle: "Lendo o processo pelas regras do jogo",
    },
  },
  {
    expectations: `
      Titles must be in Latin American Spanish.
      This lesson should likely land around 3-5 explanation activities.
      Avoid turning each concept label into its own title such as "Biosignatura" or "Oxígeno atmosférico".

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-exoplanetas-vida-sin-exagerar",
    userInput: {
      chapterTitle: "Exoplanetas",
      concepts: [
        "Biosignatura",
        "Oxígeno atmosférico",
        "Ozono atmosférico",
        "Desequilibrio químico",
        "Biofirma espectral",
        "Falso positivo biológico",
      ],
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Aclara qué señal podría sugerir vida y por qué ninguna se interpreta sola. La clave está en leer el contexto completo antes de hacer afirmaciones grandes.",
      lessonTitle: "Buscando señales de vida sin exagerar",
    },
  },
  {
    expectations: `
      Titles must be in Brazilian Portuguese.
      All four concepts (Programa, Código-fonte, Execução do programa, Saída de texto) roll up to a single takeaway at this stage: "você escreve instruções e elas aparecem como resultado quando o código roda."
      Penalize any plan where 3+ activities paraphrase that same takeaway.
      A 1-2 activity plan that covers "writing the code" together with "running it and seeing output" would pass; a 4-activity plan that splits Programa / Código-fonte / Execução / Saída 1:1 would fail because at this stage the learner cannot distinguish "programa" from "código-fonte" or separate "execução" from "ver o resultado".

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-computacao-primeiro-programa",
    userInput: {
      chapterTitle: "Seus primeiros programas",
      concepts: ["Programa", "Código-fonte", "Execução do programa", "Saída de texto"],
      courseTitle: "Ciência da Computação",
      language: "pt",
      lessonDescription:
        "Dê nome às peças básicas antes de digitar qualquer coisa. Aqui o computador deixa de ser uma caixa-preta e vira uma máquina que lê código e produz um resultado visível.",
      lessonTitle: "Fazendo o computador mostrar alguma coisa",
    },
  },
  {
    expectations: `
      Titles must be in US English.
      This lesson should likely land around 3-5 explanation activities.
      Avoid one title per optimizer trick such as "AdamW", "Label Smoothing", or "Gradient Clipping".

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-transformers-training-stability",
    userInput: {
      chapterTitle: "Transformers",
      concepts: [
        "Dropout in Attention",
        "Label Smoothing",
        "Learning Rate Warmup",
        "AdamW",
        "Gradient Clipping",
      ],
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Training transformers well depends on a handful of optimization choices that became standard for a reason. These pieces help large models learn stably instead of blowing up or stalling.",
      lessonTitle: "Training transformers without instability",
    },
  },
  {
    expectations: `
      Titles must be in US English.
      This lesson should land around 4-5 activities. Each component of a transformer block — attention, layer normalization, residual connections, feed-forward network — has a distinct mechanical role the learner needs to grasp on its own.
      Penalize plans that bundle 3+ of these components into a single umbrella activity like "the main parts of a block" or "components that keep it stable". A 2-activity plan that groups distinct mechanisms under umbrella goals fails the split test even if the goals sound coherent.
      Reward plans where each goal describes a distinct operation the block performs (attention routing information, normalization stabilizing values, residuals preserving the signal, FFN transforming representations).

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-transformers-block-internals",
    userInput: {
      chapterTitle: "Transformers",
      concepts: [
        "Multi-Head Attention",
        "Layer Normalization",
        "Residual Connection",
        "Feed-Forward Network",
        "Pre-Norm vs Post-Norm",
      ],
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Walk through the components inside a single transformer block and see how each one does its own job before the next one takes over. The block is stable because each piece solves a specific problem that the others cannot.",
      lessonTitle: "Building a stable transformer block",
    },
  },
  {
    expectations: `
      Titles must be in Latin American Spanish.
      This lesson should land around 3-4 activities. Detecting a planet by radial velocity involves mechanically distinct steps: the Doppler shift itself, reading the velocity curve over time, inferring mass and orbit, and ruling out stellar confounders.
      Penalize plans that collapse the Doppler effect and the mass inference into a single "how radial velocity works" activity — each has its own operation.
      A 2-activity plan that bundles 3+ of these mechanisms under an umbrella goal ("así se detecta el planeta") fails the split test.

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-astronomia-velocidad-radial",
    userInput: {
      chapterTitle: "Exoplanetas",
      concepts: [
        "Efecto Doppler",
        "Velocidad radial",
        "Curva de velocidades",
        "Wobble estelar",
        "Inferencia de masa",
      ],
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Detecta un planeta por el tirón que provoca en su estrella. Cada paso del método — desde leer el desplazamiento Doppler hasta estimar la masa — usa una operación distinta que hay que entender por separado.",
      lessonTitle: "Detectando el tirón gravitatorio de un planeta",
    },
  },
  {
    expectations: `
      Titles must be in US English.
      This lesson should land at 4-5 activities — one per stroke of the cycle, with an optional 5th activity on why the strokes must happen in order (ordering-as-mechanism is a legitimate distinct takeaway). Each stroke (intake, compression, power, exhaust) is a distinct mechanical event with its own role: intake draws in the mixture, compression raises pressure, power converts combustion to motion, exhaust expels burnt gases.
      Penalize plans that bundle 2+ strokes under umbrella goals like "the preparation phase" or "what happens before combustion". A 2-activity plan pairing intake+compression and power+exhaust is the classic 2-concept bundling failure.
      Reward plans where each goal describes a distinct operation the stroke performs.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-engine-four-stroke-cycle",
    userInput: {
      chapterTitle: "How an engine converts fuel into motion",
      concepts: ["Intake", "Compression", "Power Stroke", "Exhaust"],
      courseTitle: "Internal Combustion Engines",
      language: "en",
      lessonDescription:
        "Follow what happens inside one cylinder during a single cycle. Each of the four strokes does its own mechanical job, and the cycle only works because the strokes happen in order.",
      lessonTitle: "What happens in one cycle of a four-stroke engine",
    },
  },
  {
    expectations: `
      Titles must be in Brazilian Portuguese.
      This lesson should land around 4-5 activities. The stages that are genuinely mechanistically distinct — evaporação (phase change via heat), condensação (saturation forming clouds), precipitação (droplets getting heavy enough to fall) — must be separate activities. Penalize plans that bundle these three under umbrella narratives like "the downward arc", "as mudanças de estado", or "o retorno à superfície".
      Coleta (accumulation in water bodies) and escoamento (surface runoff) are both "water at the surface" stages and may reasonably pair into a single activity for a first-exposure lesson; do not penalize that specific pairing. Do penalize plans that bundle coleta or escoamento together with precipitação into an umbrella activity — that crosses the 3+ mechanism bundling line.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ciencias-ciclo-da-agua",
    userInput: {
      chapterTitle: "Como a água circula no planeta",
      concepts: ["Evaporação", "Condensação", "Precipitação", "Coleta", "Escoamento"],
      courseTitle: "Ciências Naturais",
      language: "pt",
      lessonDescription:
        "Siga uma gota de água pelo ciclo completo, desde a superfície até o céu e de volta. Cada etapa acontece por um motivo físico diferente, e o ciclo só funciona porque as etapas se conectam na ordem certa.",
      lessonTitle: "Seguindo uma gota pelo ciclo da água",
    },
  },
];
