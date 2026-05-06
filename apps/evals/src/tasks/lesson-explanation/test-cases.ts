const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: The explanation must be technically correct for the topic. Penalize invented mechanisms, wrong cause-effect chains, or misleading simplifications.

2. REQUIRED STRUCTURE: The output must contain exactly two top-level fields:
   - explanation[]: an array of explanation steps, each with title and text
   - anchor: { title, text } (no visual)

3. LESSON DELIVERY: The lesson must actually deliver on LESSON_TITLE and LESSON_DESCRIPTION. The learner should finish with a full working understanding of what the topic is, how it works, how it is used/measured/written/recognized in practice when relevant, why it matters when relevant, and what the important terms, formulas, structures, rules, caveats, or limits mean. Penalize lessons that stay friendly but surface-level, or technically dense but hard to understand.

4. BEGINNER + EXPERT FIT: The lesson should feel like a precise expert explaining the topic to a smart non-expert friend. It should use everyday language without dumbing down the topic. Penalize:
   - Academic phrasing that makes a simple idea feel harder than it is
   - "Friendly" explanations that omit the expert essentials required by the lesson scope
   - Dense explanations that contain the right terms but do not explain them in plain language
   - Formal terms, formulas, or code snippets that appear without enough plain-language explanation

5. MECHANISM + FORMAL DETAIL: The lesson must include the real mechanism, structure, relationship, calculation, rule, or procedure required by the title and description. Penalize:
   - Skipping formulas, variables, code shapes, uncertainty, exceptions, limits, or precise terms that an expert would expect for this lesson scope
   - Including those details without explaining what the parts mean
   - Using an analogy, vibe, story, or visual scene as a substitute for the actual mechanism

6. LESSON BOUNDARY: The lesson must stay focused on the selected LESSON_TITLE and leave sibling angles in OTHER_EXPLANATION_LESSON_TITLES for those other lessons. Penalize explanations that spend their main teaching energy on a sibling lesson instead of the chosen one.

7. EXPLANATION FLOW: There is no required opening pattern, cold open, or story arc. The explanation[] array should choose the clearest order for this topic and connect ideas so the learner can follow how the topic works. Penalize:
   - Stacked definitions that do not connect to each other
   - Scenic or subjective prose that does not help explain the concept
   - Missing the practical payoff when the lesson calls for why this matters
   - Naming terms before giving enough context to understand them, when that makes the lesson harder to follow

8. STEP QUALITY: Each step.text is 1-3 short sentences of prose. Step titles are short, unique, and useful for understanding what the step teaches. Penalize:
   - Long paragraphs
   - Titles that are only props, moods, vague story beats, or generic labels
   - Repetition between steps

9. CONCRETENESS: The lesson should use concrete examples, measurements, cases, code-shaped details, or realistic situations when they make the mechanism easier to understand. Penalize:
   - Vague prose that never makes the mechanism concrete
   - Examples that are only atmospheric decoration
   - Lessons about "how it's written" that never describe the structure or code detail clearly enough to understand

10. STATIC + RICH TEXT DELIVERY: The lesson should stay entirely within explanation steps plus the closing anchor. It may use inline LaTeX, display LaTeX, bold, italic, and inline code with single backticks. Penalize:
   - Quiz-like interruptions, option lists, or explicit "guess before continuing" instructions
   - Steps that stop to ask the learner to choose instead of explaining
   - Rhetorical-question-only steps that replace a real explanation
   - Markdown headings, lists, tables, links, or large code fences inside a step
   - Malformed LaTeX or unsupported formatting that would show raw clutter to the learner

11. ANCHOR QUALITY: anchor has no visual. It answers why the topic is useful and where it shows up outside the lesson by naming one specific real-world instance — a named product (e.g., Instagram, WhatsApp), recognizable product family (e.g., ChatGPT-style models), named technology/service/system, named mission/instrument, named event/figure/case/place, or concrete physical action the learner has actually done — and what it does there. Penalize:
   - Abstract "this is why it matters" wrap-ups
   - Metaphors or vague generalities
   - Classroom demonstrations, lab videos, school apparatus, research instruments, or professional workflows that do not name the product, service, system, or public-world outcome they enable
   - Category-list anchors that name a type of use instead of a vivid instance ("a star, a lamp, or a gas cloud"; "many apps"; "some medical devices")
   - Generic placeholders standing in for a specific real thing ("a real app", "a real court case", "an exoplanet", "every time a button does X in three places")

12. STYLE: Clear, short, concrete, beginner-friendly, and precise. Penalize academic tone, atmospheric storytelling, filler lines, subjectivity that does not teach, and redundancy across steps and anchor.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require a fixed number of steps. Complex topics need more; simple topics fewer. Both are fine as long as the lesson is delivered
- Do NOT require a cold open, story arc, single scene, or specific opening style
- Do NOT require specific title wording, a particular choice of product or event, or a specific visual kind. The anchor must name some specific real thing, but any reasonable choice is fine — do not penalize the model for picking Instagram over WhatsApp, or one named case over another
- Do NOT penalize anchors that use a widely recognized product family tied to a named product, such as "ChatGPT-style models", when the learner can clearly recognize the real-world surface
- Do NOT penalize direct explanatory writing when it is clear, plain, concrete, and complete
- Do NOT penalize density when the density comes from necessary expert content explained in everyday language
- Do NOT focus on JSON wrapping or formatting trivia. Evaluate the content and structural fit
- ONLY penalize for: wrong top-level structure, factual errors, failing to deliver LESSON_TITLE and LESSON_DESCRIPTION, missing beginner/expert balance, missing required mechanism/detail, drifting into sibling lessons, unclear flow, unsupported formatting, weak real-world anchor, or broken writing constraints
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about what makes repeated code become one reusable function. Penalize if:
   - Declaring a function is confused with calling it
   - The function name, parameters, or body are treated as optional decoration instead of the structure that defines the reusable block

2. BOUNDARY CHECK: The core arc should stay on the reusable block itself. Penalize if the explanation spends its main teaching move on sibling angles like function calls or return values.

${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript-named-block",
    userInput: {
      chapterTitle: "Functions, Arrays, and Objects",
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Break a repeated task into a named block of code and run it when needed. These ideas make code shorter, easier to read, and easier to change later.",
      lessonTitle: "Turning repeated code into a function",
      otherLessonTitles: [
        "What happens when you run the function",
        "When a function gives something back",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about raids, captives, and what conflict was trying to achieve. Penalize if:
   - Raids are reduced to random violence or simple looting
   - Captives are treated as incidental rather than part of the meaning and aim of warfare

2. BOUNDARY CHECK: The main arc should stay on raids, captives, and conflict aims. Brief context about honor, memory, alliance, or revenge is fine when it explains why raids or captives mattered. Penalize if revenge logic, colonial stereotypes, or war leadership becomes the primary lesson instead of support for raids and captives.

${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-raid-purpose",
    userInput: {
      chapterTitle: "Indigenous Brazil Before Colonization",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Examine raids and captives on their own terms instead of through colonial stereotypes. Show how conflict could follow rules tied to honor, memory, alliance, and the taking of captives.",
      lessonTitle: "Why raids and captives mattered in warfare",
      otherLessonTitles: [
        "Seeing warfare on its own terms",
        "Why revenge was more than retaliation",
        "How war leaders earned the right to lead",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about due process, contradiction, and defense preventing procedural surprise. Penalize if:
   - The parties are shown as learning decisive information only after the judge acts
   - Contraditório or ampla defesa are reduced to empty formalities instead of a real chance to know and respond

2. BOUNDARY CHECK: The core arc should stay on avoiding surprise in the process. Brief mentions of procedure, request limits, deadlines, evidence, or reasoning are fine when they explain how the parties know, respond, and influence before a decision. Penalize if the explanation becomes a broad survey of civil-procedure principles or spends its main energy on who can start the case or equality between the parties.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-sem-surpresa",
    userInput: {
      chapterTitle: "Processo Civil",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Entenda como devido processo legal, contraditório e ampla defesa impedem decisões surpresa. A ideia central é saber, responder e influenciar antes que o juiz decida.",
      lessonTitle: "Como o processo evita decisões surpresa",
      otherLessonTitles: [
        "Quando o processo começa: quem pode pôr a máquina em movimento",
        "O que significa tratar as partes com igualdade de verdade",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about measuring hydrogen spectral lines from positions and angles, then turning those readings into wavelengths. Penalize if:
   - Spectral lines are treated as decorative colors instead of measured wavelengths
   - Diffraction angles, wavelength, or uncertainty are described with a wrong cause-effect chain

2. REAL-WORLD ANCHOR CHECK: The anchor must not end at a lab video, school spectroscope, classroom demo, or "next time you see this in a lab" framing. It should connect the measured-spectrum idea to a product, technology, system, or public-world result a normal learner can recognize, such as phone/display color tuning, LED or laser manufacturing, medical or environmental spectroscopy, or identifying hydrogen in named telescope observations.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-fisica-quantica-linhas-hidrogenio",
    userInput: {
      chapterTitle: "A assinatura colorida do hidrogênio",
      courseTitle: "Física Quântica",
      language: "pt",
      lessonDescription:
        "Trace o caminho do tubo de descarga até o padrão no espectroscópio: gás excitado, fenda, rede ou prisma e linhas separadas por cor. Use ângulos, ordens de difração e incerteza de leitura para transformar posições no anteparo em comprimentos de onda.",
      lessonTitle: "Medir as linhas do hidrogênio",
      otherLessonTitles: [
        "Calcular a série de Balmer",
        "Encontrar séries e limites espectrais",
        "Ligar cores a saltos de energia",
        "Julgar o alcance do modelo de Bohr",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about false positives in biosignature claims. Penalize if:
   - Oxygen, ozone, or any single signal is treated as proof of life
   - A false positive is described as bad data instead of a non-biological explanation that still fits the observation

2. BOUNDARY CHECK: The explanation should stay centered on ruling out alternative explanations before claiming life. Penalize if it turns into a general lesson on oxygen, ozone, or chemical disequilibrium without returning to the false-alarm decision.

${SHARED_EXPECTATIONS}
    `,
    id: "es-exoplanetas-falsas-alarmas",
    userInput: {
      chapterTitle: "Exoplanetas",
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Aclara qué señal podría sugerir vida y por qué ninguna se interpreta sola. La clave está en leer el contexto completo antes de hacer afirmaciones grandes.",
      lessonTitle: "Buscando señales de vida sin exagerar",
      otherLessonTitles: [
        "Cuándo una señal sugiere vida y cuándo todavía no",
        "Qué nos dicen el oxígeno y el ozono en la atmósfera",
        "Leer una atmósfera como un sistema, no como una lista de gases",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about the first stability safeguards in transformer training. Penalize if:
   - AdamW, warmup, and gradient clipping are collapsed into one indistinct trick
   - Gradient clipping is treated as replacing the optimizer or learning-rate schedule

2. BOUNDARY CHECK: The main arc should keep AdamW, warmup/decay, and gradient clipping central. Do not penalize brief supporting safeguards such as pre-normalization, initialization, batch size, or mixed precision when they explain transformer stability and do not replace the central trio. Penalize if label smoothing or attention dropout becomes the primary teaching move instead of sibling context.

3. REAL-WORLD ANCHOR CHECK: ChatGPT, ChatGPT-style models, or another recognizable deployed LLM product/system is a valid real-world anchor. Do not penalize it as a generic category when the anchor clearly connects training stability to a product learners recognize.

${SHARED_EXPECTATIONS}
    `,
    id: "en-transformers-first-training-steps",
    userInput: {
      chapterTitle: "Transformers",
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Training transformers well depends on a handful of optimization choices that became standard for a reason. These pieces help large models learn stably instead of blowing up or stalling.",
      lessonTitle: "Training transformers without instability",
      otherLessonTitles: [
        "Making attention less brittle while the model learns",
        "Training for confidence without overconfidence",
      ],
    },
  },
];
