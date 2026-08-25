export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about what makes repeated code become one reusable function. Penalize if:
   - Declaring a function is confused with calling it
   - The function name, parameters, or body are treated as optional decoration instead of the structure that defines the reusable block

2. BOUNDARY CHECK: The core arc should stay on the reusable block itself. Penalize if the explanation spends its main teaching move on sibling angles like function calls or return values.
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

3. BEGINNER TRACE CHECK: Before introducing a lettered tree, the lesson should plainly define what a tree traversal is and what it means to process a node. DFS and BFS should be named and defined before or at the start of their respective traces, not revealed after an unexplained movement pattern. The learner should see enough intermediate branch, stack, or queue state to understand why the order emerges; a final visitation sequence or later variation does not replace this base trace.

4. IMMEDIATE USE + CHOICE CHECK: Pair each named traversal order with a simple use or consequence while that order is being taught, especially the parent-before-children purpose of pre-order and the children-before-parent purpose of post-order. A final paragraph that lists uses after all traces does not provide the same local understanding. Close the lesson with a practical choice rule that helps the learner select DFS, BFS, pre-order, in-order, or post-order from the processing goal; an anchor about only one traversal does not replace that synthesis.
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
   - The constitutional basis in article 5, LIV and LV is omitted, or the CPC protection against surprise in articles 9 and 10 is presented inaccurately

2. BOUNDARY CHECK: The core arc should stay on avoiding surprise in the process. Brief mentions of procedure, request limits, deadlines, evidence, or reasoning are fine when they explain how the parties know, respond, and influence before a decision. Penalize if the explanation becomes a broad survey of civil-procedure principles or spends its main energy on who can start the case or equality between the parties.

3. CONCEPT + EXAMPLE CHECK: The lesson should explicitly connect the concepts in order: due process is the broader guarantee, contraditório provides knowledge, response, and influence, ampla defesa supplies real means of defense, and the prohibition on surprise applies those guarantees to the decisive basis. Define a surprise decision plainly and pair it with a fully specified example that names the issue originally debated, the new decisive issue, and the missing chance to respond. Penalize vague examples whose reader must guess what “another issue,” “a defect,” or a similar reference means.

4. PLAIN-LANGUAGE LEGAL GROUNDING CHECK: Preserve the constitutional and statutory basis, but immediately translate what each cited guarantee or rule means for an ordinary party in concrete language. Expand CPC as Código de Processo Civil at first use. Contraditório, ampla defesa, article 9, and article 10 should each receive a plain action, situation, or consequence near their definition; a later worked case does not repair an earlier block of formal or academic definitions.

5. CLOSING SYNTHESIS CHECK: After the worked situation, recap how due process, knowledge, response, means of defense, influence, and the ban on surprise fit together. A strong ending gives the learner a short practical check for deciding whether the guarantees were respected; ending only with a boundary distinction or narrow anchor is weaker.
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

3. BEGINNER ORDER CHECK: Establish the basic objects before explaining why the code has its structure: mRNA is read in groups, each three-base group is a codon, and each codon identifies an amino acid or signal. Then demonstrate the table, start/stop signals, degeneracy, and changed reading frame. A combinatorial explanation of why triplets provide enough possibilities is optional supporting detail, not the learner's entry point.

4. PURPOSE + FAMILIAR TRANSFER CHECK: Before developing notation, orient the learner to the purpose: reading mRNA in codons tells the cell which amino acids to join into a protein. The closing anchor should make that decoding useful through a familiar application that needs no specialist biology knowledge. Penalize anchors centered on a rare disease, obscure gene, or unexplained protein mechanism when the learner must understand that new topic before the genetic-code lesson becomes concrete.

5. ANCHOR TRANSFER CHECK: A familiar mRNA-vaccine example is valid transfer when it plainly connects the decoded message to the cell joining amino acids into a protein; it does not need to teach the named protein's biology. Penalize an anchor that only compares the sequence to an edited message or repeats that regrouping letters changes later groups, because that restates the lesson instead of showing where the completed model matters outside it.
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

3. FAMILIAR SCENARIO CHECK: Introduce one simple request-to-delivery scenario before or together with the two definitions, then keep its request, start, completion, and delivery events stable while calculating both measures. Pair each metric's definition immediately with what it measures in that scenario. A lesson that opens with abstract clock definitions and postpones the first concrete item until later is less effective for a beginner.

4. WAITING + DECISION CHECK: Give the time before work starts explicit emphasis as the central reason lead time can exceed cycle time. Show what the comparison reveals and close with a practical decision rule: a long lead time with short cycle time points to waiting before work, while a long cycle time points to work after the start. Additional boundary caveats are useful only after this base interpretation is clear.
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

3. BEGINNER ORDER CHECK: A brief familiar contrast may come first when it changes only the timing of payment and immediately reveals that profit and available cash answer different questions. The lesson should then define profit, cash, and accrual timing before asking the learner to track inventory, receivables, financial position, or several transaction states at once. Do not reward a fully reconciled accounting trace over a simpler familiar case when the trace introduces more undefined accounts and state changes before the central distinction is established.

4. SIMPLE CONTRAST + TRANSFER CHECK: The first example should isolate why earning revenue and receiving money can happen at different times. Penalize an opening that makes a beginner simultaneously track starting cash, split costs, multiple payment dates, receivables, payables, and net financial position when those details can be removed without changing the profit-versus-cash insight. Each report or perspective should be translated into the practical question it answers, and the closing transfer should help the learner recognize the distinction in a familiar business situation rather than merely reconcile the example's accounts.
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
   - A second-order line treated as first order is said to produce a wavelength that is too small; for the same observed angle, using |m| = 1 instead of the correct |m| = 2 makes the inferred wavelength twice too large

2. REAL-WORLD ANCHOR CHECK: The anchor must not end at a lab video, school spectroscope, classroom demo, or "next time you see this in a lab" framing. It should connect the measured-spectrum idea to a product, technology, system, or public-world result a normal learner can recognize, such as phone/display color tuning, LED or laser manufacturing, medical or environmental spectroscopy, or identifying hydrogen in named telescope observations.

3. BEGINNER MEASUREMENT ORDER CHECK: State the measurement goal first: turn a visible hydrogen line into a wavelength with an uncertainty that can be compared. Define the central measured quantity and orient the learner to diffraction order and grating spacing before moving through position, angle, equation, and uncertainty. Penalize an explanation that starts manipulating positions or angles before the learner knows the target quantity and the purpose of those moves, even when the later calculation is correct.
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

   Penalize an anchor that ends only with a car, steering, speed, traction-control, or circuit-breaker analogy without connecting the safeguards to a recognizable deployed model or system. That analogy may clarify roles inside the lesson, but it is not the requested real-world transfer by itself.

4. BEGINNER ROADMAP CHECK: Before developing any one safeguard in detail, name AdamW, warmup/decay, and gradient clipping and give the learner a simple map of the different part of training each one controls. Penalize outputs that develop the safeguards one by one and reveal their overall relationship only later.
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
   - A right triangle is said to require three different side lengths; isosceles right triangles have two equal legs
   - The side lengths are confused with the areas of the squares built on those sides
   - Rearranging the same congruent triangles is treated as changing their total area

2. BOUNDARY CHECK: The main arc should stay on seeing why the two smaller square areas equal the largest square area. Brief algebra is fine when it records the area comparison. Penalize if the lesson becomes mainly about the distance formula, coordinate proofs, trigonometry, Pythagorean triples, or the converse theorem.
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
