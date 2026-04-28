const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FACTUAL ACCURACY: The explanation must be technically correct for the topic. Penalize invented mechanisms, wrong cause-effect chains, or misleading simplifications.

2. REQUIRED STRUCTURE: The output must contain exactly two top-level fields:
   - explanation[]: an array of narrative steps, each with title and text
   - anchor: { title, text } (no visual)

3. GOAL DELIVERY: The lesson must actually deliver on LESSON_GOAL. The learner should finish the lesson knowing what the thing is, why it exists or is used (when the goal implies it), and how it works or is written in practice (when the goal implies it). Penalize lessons that stay surface-level and leave the learner still unsure what the thing is, why it matters, or how it's written when the goal required these.

4. LESSON BOUNDARY: The lesson must stay focused on the selected LESSON_TITLE and leave sibling angles in OTHER_EXPLANATION_LESSON_TITLES for those other lessons. Penalize explanations that spend their main arc teaching a sibling lesson instead of the chosen one.

5. SCENE SPINE: The entire lesson must revolve around ONE concrete moment (e.g. tapping a button, sending a message, opening a contact list). Every step refers back to or deepens that same moment. The single scene is the vehicle for covering what/why/how when the goal requires all three. Penalize:
   - Lessons that jump between multiple unrelated scenarios
   - An opening scenario that gets abandoned after step 1
   - Definitions that float in abstractly instead of pointing at something already shown in the scene

6. COLD OPEN: Step 1 must land the learner inside a concrete sensory moment with no question-as-hook, no "Imagine...", no resolution, and no definition. Penalize steps that answer their own setup within the same step, or that open with abstract framing.

7. NARRATIVE ARC: The explanation[] array should unfold a clear arc: cold open → mystery (something hidden) → reveal (what was hidden) → naming (from inside the scene) → zoom (into one piece, often "how") → optional stakes (why, when the goal calls for it) → payoff (callback to the opening). Step count is flexible — deeper topics need more steps, simpler topics fewer — but these narrative functions should be present in order. Penalize:
   - A structure that reads as stacked definitions rather than a single unfolding story
   - Missing a payoff/callback as the last step
   - Naming a term before showing an example of it in the scene

8. STEP QUALITY: Each step.text is 1–3 short sentences of prose. Step titles are short (1–3 words), narrative markers (not textbook section headers), and unique within the lesson. Penalize:
   - Long paragraphs
   - Titles like "Programa", "Instrução", "Encapsulation" that sound like chapter headers
   - Repetition between steps

9. STEP CONCRETENESS: The explanation steps must be specific enough that a downstream image-prompt task could clearly infer what should be shown. Penalize:
   - Vague prose that never makes the scene or reveal concrete
   - Mechanism steps that stay too abstract to picture
   - "How it's written" goals that never describe the structure or code detail clearly enough to visualize

10. STATIC-ONLY DELIVERY: The lesson should stay entirely within narrative explanation steps plus the closing anchor. Penalize:
   - Quiz-like interruptions, option lists, or explicit "guess before continuing" instructions
   - Steps that stop the narrative to ask the learner to choose instead of revealing the next beat
   - Rhetorical-question-only steps that replace a real explanation move

11. ANCHOR QUALITY: anchor has no visual. It callbacks the opening scene by naming a specific real thing — a named product (e.g., Instagram, WhatsApp), a named event/figure/case, or a concrete physical action the learner has actually done — and what it does there. Penalize:
   - Abstract "this is why it matters" wrap-ups
   - Brand new scenarios unrelated to the opening
   - Metaphors or vague generalities
   - Generic placeholders standing in for a specific real thing ("a real app", "a real court case", "an exoplanet", "every time a button does X in three places")

12. STYLE: Clear, short, concrete, beginner-friendly. Penalize academic tone, filler lines, and redundancy across steps and anchor.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require a fixed number of steps. Complex topics need more; simple topics fewer. Both are fine as long as the arc is present and the goal is delivered
- Do NOT require specific title wording, a particular choice of product or event, or a specific visual kind. The anchor must name some specific real thing, but any reasonable choice is fine — do not penalize the model for picking Instagram over WhatsApp, or one named case over another
- Do NOT penalize creative scenes as long as they stay concrete and the same scene threads through every step
- Do NOT focus on JSON wrapping or formatting trivia. Evaluate the content and structural fit
- ONLY penalize for: wrong top-level structure, factual errors, failing to deliver LESSON_GOAL, drifting into sibling lessons, broken scene continuity, weak cold open, missing arc, weak imagery cues, anchor drift, or broken writing constraints
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

2. BOUNDARY CHECK: The main arc should stay on raids and captives. Penalize if the explanation turns into a broader lesson about colonial stereotypes, revenge logic, or war leadership instead of this selected lesson.

${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-raid-purpose",
    userInput: {
      chapterTitle: "Indigenous Brazil Before Colonization",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Examine conflict on its own terms instead of through colonial stereotypes. Warfare often followed rules tied to honor, memory, alliance, and the taking of captives.",
      lessonTitle: "Understanding warfare beyond colonial stereotypes",
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

2. BOUNDARY CHECK: The core arc should stay on avoiding surprise in the process. Penalize if the explanation spends its main energy on who can start the case or on equality between the parties, which belong to sibling lessons.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-sem-surpresa",
    userInput: {
      chapterTitle: "Processo Civil",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Entenda as regras básicas que dão forma ao processo civil e limitam o poder do juiz e das partes. Esse bloco ajuda a ler qualquer procedimento sem se perder no caminho.",
      lessonTitle: "Lendo o processo pelas regras do jogo",
      otherLessonTitles: [
        "Quando o processo começa: quem pode pôr a máquina em movimento",
        "O que significa tratar as partes com igualdade de verdade",
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

2. BOUNDARY CHECK: The main arc should stay on the early-training stability trio. Penalize if label smoothing or attention dropout becomes the primary teaching move instead of sibling context.

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
