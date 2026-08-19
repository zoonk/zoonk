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
      chapterTitle: "Functions, parameters, and return values",
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Turn duplicated code into a reusable function by naming the repeated job, making the changing parts parameters, and returning the useful result. Practice choosing what should stay inside the function and what should be supplied by each call.",
      lessonTitle: "Extracting reusable functions",
      otherLessonTitles: [
        "Function declarations and calls",
        "Parameters and arguments",
        "Return values",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about tracing depth-first and breadth-first traversals in trees. Penalize if:
   - DFS is described as visiting every node on one level before descending, or BFS as following one branch before returning
   - Pre-order, in-order, and post-order do not process the node respectively before, between, or after its child subtrees; in-order should not be generalized beyond the left-node-right structure of a binary tree
   - DFS is disconnected from recursion or an explicit stack, or BFS is disconnected from the FIFO behavior of a queue

2. BOUNDARY CHECK: The core arc should trace pre-order, in-order, post-order, and level-order traversal on a concrete tree while explaining when each node is processed and why a stack or queue produces that order. Brief uses or complexity notes are fine when they clarify the comparison. Penalize if the lesson becomes mainly about binary-search-tree operations, tree representation, recursion syntax, graph traversal with visited sets, balancing, heaps, or a catalog of applications.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-ciencia-computacao-percursos-arvores",
    userInput: {
      chapterTitle: "Estruturas de dados",
      courseTitle: "Ciência da Computação",
      language: "pt",
      lessonDescription:
        "Rastreie percursos em pré-ordem, em ordem, pós-ordem e por níveis, observando quando cada nó é processado. Relacione percursos em profundidade a recursão ou pilhas e percursos em largura ao uso de filas.",
      lessonTitle: "Percursos em árvores: DFS e BFS",
      otherLessonTitles: [
        "Tipos abstratos de dados e invariantes",
        "Arrays (vetores) e memória contígua",
        "Arrays dinâmicos e redimensionamento",
        "Listas simplesmente ligadas",
        "Listas duplamente ligadas e circulares",
        "Localidade de memória e overhead de referências",
        "Pilhas (stacks)",
        "Filas e buffers circulares",
        "Filas de duas pontas (deques)",
        "Funções hash, igualdade e buckets",
        "Tratamento de colisões em tabelas hash",
        "Fator de carga e redimensionamento de tabelas hash",
        "Anatomia e representação de árvores",
        "Árvores binárias de busca: busca e inserção",
        "Remoção em árvores binárias de busca",
        "Árvores balanceadas: AVL e rubro-negras",
        "Heap binário: propriedade e representação",
        "Filas de prioridade com heaps",
        "Grafos: vértices, arestas e tipos",
        "Representações de grafos",
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
      chapterTitle: "Indigenous Brazil before 1500",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Recognize warfare as a political and ritual practice that varied by region. Use fortified sites, oral memory, and early accounts carefully to examine raids, revenge, alliances, captive taking, and defense.",
      lessonTitle: "Warfare, alliances, and captives",
      otherLessonTitles: [
        "Archaeological evidence and dating",
        "Oral traditions and early written sources",
        "Leadership, kinship, and ritual authority",
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
      chapterTitle: "Direitos fundamentais",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Relacione devido processo legal, contraditório e ampla defesa à proibição de decisão surpresa. O aluno identifica quando as partes tiveram conhecimento, chance de resposta e possibilidade real de influenciar a decisão.",
      lessonTitle: "Contraditório, ampla defesa e decisão surpresa",
      otherLessonTitles: [
        "Devido processo legal",
        "Direito de ação e acesso à Justiça",
        "Igualdade processual",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about reading mRNA in codons while preserving the correct reading frame. Penalize if:
   - DNA bases are read directly from an mRNA codon table without first producing the corresponding mRNA sequence
   - The reading frame is treated as optional or as changing one codon without changing the triplet grouping that follows
   - The degeneracy of the genetic code is described as one codon routinely specifying several different amino acids

2. BOUNDARY CHECK: The core arc should stay on codons, the start and stop signals, using the genetic-code table, and why the reading frame matters. Brief context about transcription, tRNA, or translation is fine when it helps the learner follow that decoding move. Penalize if the explanation turns into a broad survey of DNA structure, RNA processing, ribosome stages, or mutation types.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-codigo-genetico",
    userInput: {
      chapterTitle: "DNA, RNA e expressão gênica",
      courseTitle: "Biologia",
      language: "pt",
      lessonDescription:
        "Leia o mRNA em trincas e use uma tabela do código genético para converter códons em aminoácidos. Reconheça o códon de início, os códons de parada, a degeneração do código e a importância do quadro de leitura.",
      lessonTitle: "Código genético, códons e quadro de leitura",
      otherLessonTitles: [
        "Dogma central e transcrição reversa",
        "Transcrição e RNA polimerase",
        "Processamento do RNA mensageiro",
        "mRNA, tRNA, rRNA e aminoacil-tRNA sintetases",
        "Iniciação da tradução",
        "Elongação da tradução e sítios A, P e E",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about measuring two different intervals in a workflow. Penalize if:
   - Lead time does not run from request to delivery, or cycle time does not run from work start to completion
   - The two metrics are treated as interchangeable or calculated with incompatible time conventions
   - A shorter cycle time is claimed to prove a short lead time without accounting for the time spent waiting before work starts

2. BOUNDARY CHECK: The core arc should stay on defining, calculating, comparing, and using lead time and cycle time. Brief mentions of waiting, timestamps, or a board are useful when they make the two clocks concrete. Penalize if the lesson becomes mainly about throughput, WIP, work item age, forecasting, or general Kanban management.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-kanban-lead-cycle-time",
    userInput: {
      chapterTitle: "Métricas de fluxo",
      courseTitle: "Kanban",
      language: "pt",
      lessonDescription:
        "Calcule o lead time entre solicitação e entrega e o cycle time entre início e conclusão de um item. Compare os dois intervalos para reconhecer o tempo anterior ao início do trabalho sem confundir suas fronteiras.",
      lessonTitle: "Lead time e cycle time",
      otherLessonTitles: [
        "Limites de medição e eventos do fluxo",
        "Throughput e janela de medição",
        "WIP — trabalho em andamento",
        "Work item age — idade do item",
        "Taxa de chegada e taxa de saída",
        "Média, mediana e valores extremos",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about separating profit, cash, and financial position. Penalize if:
   - Profit is treated as the amount of money currently available in the bank account
   - A sale on credit is treated as immediate cash receipt, or money received from a loan is treated as revenue or profit
   - Result, cash movement, and the assets, obligations, and equity held at a point in time are collapsed into one interchangeable measure

2. BOUNDARY CHECK: The core arc should stay on why a profitable company can still lack cash and how result, cash, and financial position answer different questions. Brief mentions of accrual accounting, receivables, payables, inventory, loans, or financial statements are useful when they make the timing difference concrete. Penalize if the lesson becomes mainly a survey of accounting reports, bookkeeping entries, the accounting equation, financial ratios, or cash-flow management.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-contabilidade-lucro-caixa",
    userInput: {
      chapterTitle: "Contabilidade: a linguagem das decisões",
      courseTitle: "Contabilidade",
      language: "pt",
      lessonDescription:
        "Uma empresa pode apresentar lucro e, ainda assim, ficar sem dinheiro para pagar as contas. Relatórios contábeis ajudam a distinguir resultado, caixa e patrimônio — três perspectivas diferentes sobre a saúde de uma organização.",
      lessonTitle: "Por que lucro e dinheiro em caixa não são a mesma coisa",
      otherLessonTitles: [
        "Como a contabilidade transforma fatos em informação",
        "A balança contábil entre bens, dívidas e patrimônio",
        "Onde a contabilidade orienta decisões e carreiras",
        "Como a contabilidade cria confiança na sociedade",
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
      chapterTitle: "Espectro do hidrogênio e modelo de Bohr",
      courseTitle: "Física Quântica",
      language: "pt",
      lessonDescription:
        "Meça linhas espectrais do hidrogênio a partir de posições, ângulos, ordens de difração e incerteza de leitura. O aluno transforma observações no espectroscópio em comprimentos de onda comparáveis.",
      lessonTitle: "Medição das linhas espectrais do hidrogênio",
      otherLessonTitles: [
        "Série de Balmer",
        "Séries espectrais e limites de ionização",
        "Transições de energia no hidrogênio",
        "Limites do modelo de Bohr",
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
      chapterTitle: "Habitabilidad y astrobiología",
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Evalúa biofirmas posibles en atmósferas de exoplanetas y las explicaciones no biológicas que pueden imitar señales de vida. El alumno usa oxígeno, ozono, metano, contexto estelar y química atmosférica para evitar falsas alarmas.",
      lessonTitle: "Biofirmas y falsos positivos",
      otherLessonTitles: [
        "Zona habitable",
        "Espectros de transmisión atmosférica",
        "Oxígeno, ozono y desequilibrio químico",
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
      chapterTitle: "Deep learning training practice",
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Use AdamW, learning-rate warmup and decay, and gradient clipping as core safeguards for stable Transformer training. Compare what each tool controls and why none of them replaces the others.",
      lessonTitle: "Transformer optimization and training stability",
      otherLessonTitles: [
        "Initialization and normalization",
        "Learning-rate schedules",
        "Dropout and regularization",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about why the Pythagorean identity follows from an area rearrangement. Penalize if:
   - The identity is applied to triangles that are not right triangles
   - The side lengths are confused with the areas of the squares built on those sides
   - Rearranging the same congruent triangles is treated as changing their total area

2. BOUNDARY CHECK: The main arc should stay on seeing why the two smaller square areas equal the largest square area. Brief algebra is fine when it records the area comparison. Penalize if the lesson becomes mainly about the distance formula, coordinate proofs, trigonometry, Pythagorean triples, or the converse theorem.

${SHARED_EXPECTATIONS}
    `,
    id: "en-geometry-pythagorean-area",
    userInput: {
      chapterTitle: "Right triangles and distance",
      courseTitle: "Geometry",
      language: "en",
      lessonDescription:
        "Use the areas of squares built on the three sides and a rearrangement of congruent right triangles to explain why the two smaller square areas add to the largest. Connect the picture to a² + b² = c² without treating the equation as a rule to memorize.",
      lessonTitle: "Why the Pythagorean theorem works",
      otherLessonTitles: [
        "Using the Pythagorean theorem",
        "The converse of the Pythagorean theorem",
        "Distance on a coordinate plane",
        "Pythagorean triples",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about distinguishing necessary conditions from sufficient conditions. Penalize if:
   - A necessary condition is treated as guaranteeing the result rather than merely being required for it
   - A sufficient condition is treated as the only possible way to reach the result rather than one condition that guarantees it
   - “If A, then B” is freely reversed into “if B, then A” without establishing the converse

2. BOUNDARY CHECK: The main arc should stay on recognizing which condition is required, which is enough, and why the direction of an implication matters. Concrete contrasting cases are useful. Penalize if the lesson becomes mainly about truth tables, formal proof notation, contraposition, logical validity, or a catalog of named fallacies.

${SHARED_EXPECTATIONS}
    `,
    id: "en-logic-necessary-sufficient",
    userInput: {
      chapterTitle: "Conditional reasoning",
      courseTitle: "Logic",
      language: "en",
      lessonDescription:
        "Distinguish necessary conditions from sufficient conditions by asking whether something is required and whether it is enough to guarantee the result. Use contrasting cases to read one-way implications without accidentally reversing them.",
      lessonTitle: "Necessary and sufficient conditions",
      otherLessonTitles: [
        "Converse, inverse, and contrapositive",
        "Biconditional statements",
        "Truth tables",
        "Validity and soundness",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about using textual evidence to recognize and interpret an unreliable narrator. Penalize if:
   - The narrator is confused with the author
   - Unreliability is treated as proof that every narrated detail is false or that the narrator must be deliberately lying
   - A reader's suspicion is presented as sufficient without contradictions, omissions, reactions, or other evidence from the work

2. BOUNDARY CHECK: The main arc should stay on how readers notice a gap between a narrator's version and what the text supports. Brief examples of bias, self-deception, limited knowledge, or deliberate deceit are useful. Penalize if the lesson becomes mainly a catalog of narrator types, point-of-view terminology, or general literary-analysis advice.

${SHARED_EXPECTATIONS}
    `,
    id: "en-literature-unreliable-narrator",
    userInput: {
      chapterTitle: "Narrators and point of view",
      courseTitle: "Literature",
      language: "en",
      lessonDescription:
        "Use contradictions, gaps, self-justification, other characters' reactions, and later events to recognize when a narrator's account cannot be accepted at face value. Build an interpretation from textual clues while allowing reasonable uncertainty about what really happened.",
      lessonTitle: "Reading an unreliable narrator",
      otherLessonTitles: [
        "First-person and third-person narration",
        "Limited and omniscient points of view",
        "Narrative distance",
        "Writing a close-reading argument",
      ],
    },
  },
];
