const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

SEVERITY GUIDE - Use this to calibrate your scoring:

SEVERE ISSUES (heavy penalty):
- Factual errors or hallucination (inventing facts not in the input)
- Testing pure memorization ("What metaphor did the text use?")
- Questions that reference "the lesson," "as explained," or similar meta-language
- Wrong tone (stiff, academic, exam-like instead of conversational)
- Format violations (wrong question count, missing fields, multiple correct answers)
- Distractors that are obviously absurd or unrelated
- Language purity violations (mixing languages)

MODERATE ISSUES (medium penalty):
- Coverage heavily skewed to one content type (e.g., 15 HOW questions, 0 WHY)
- No integration questions connecting multiple content types
- Feedback that just says "correct/incorrect" without insight
- Questions answerable without understanding (too easy)

MINOR ISSUES (light penalty or just note):
- Reusing a scenario from the input (not ideal, but okay if the question still tests understanding)
- Some questions slightly easier than others
- Feedback could be friendlier but is still helpful
- Minor missed opportunities for deeper insight

1. CONCEPTUAL ACCURACY: Questions must be factually correct. SEVERELY penalize if:
   - Questions contain factual errors or hallucinated information
   - Correct answers are actually wrong based on the input content
   - Feedback explains concepts incorrectly

2. UNDERSTANDING VS MEMORIZATION: Questions must test thinking, not recall. SEVERELY penalize if:
   - Questions ask "What did the text say?" or "Which example was used?"
   - Questions reference "the lesson," "as explained," "according to the text"
   - Questions can be answered by pattern-matching phrases from the input

3. TONE & STYLE: Must feel conversational and friendly. SEVERELY penalize if:
   - Language is stiff, formal, or exam-like
   - Feedback sounds academic or preachy
   - Questions use unexplained jargon

4. FORMAT COMPLIANCE: Must meet structural requirements. SEVERELY penalize if:
   - Question count outside 15-20 range
   - Missing required fields or wrong types
   - Multiple correct answers per question
   - Character limits exceeded

5. DISTRACTOR QUALITY: Wrong answers must be plausible. Penalize if:
   - Distractors are obviously absurd or unrelated
   - The correct answer is obvious without understanding
   - Distractors don't represent real misconceptions

6. CONTENT COVERAGE: Should test across content types. Penalize if:
   - Any content type (WHY, WHAT, HOW, WHERE) is completely missing
   - Coverage is heavily skewed

7. FEEDBACK QUALITY: Should guide learning. Penalize if:
   - Feedback just says "correct" or "incorrect" without insight
   - Wrong answer feedback doesn't point toward the correct answer

8. SCENARIO FRESHNESS (MINOR): Prefer novel scenarios, but don't heavily penalize reuse.
   - Ideal: Questions use fresh scenarios not in the input
   - Acceptable: Reusing input scenarios IF the question still tests understanding
   - Only penalize if reused scenario makes the question pure recall

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT heavily penalize scenario reuse if the question still tests understanding
- Do NOT require specific concepts to be tested by name
- Do NOT check against an imagined "complete" set of questions
- FOCUS penalties on: factual errors, memorization-based questions, wrong tone, format violations
- Different valid quiz designs exist - assess the quality of what IS provided
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in English.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Database transaction concepts must be technically accurate. Penalize if:
   - ACID properties are incorrectly described or conflated
   - Isolation levels are misrepresented (e.g., claiming serializable has no overhead)
   - Deadlock causes or prevention strategies are wrong
   - Atomicity is confused with durability

2. TRANSFER CHECK: The inputs discuss banking transfers, inventory systems, and specific examples. Questions must use completely different scenarios (e.g., airline reservations, multiplayer games, collaborative editing) to test the same concepts.

3. INTEGRATION CHECK: Look for questions that connect WHY transactions exist (data integrity problems) with HOW they work (locking, logging) and WHERE they apply (novel systems).

4. MISCONCEPTION CHECK: Distractors should include common database misconceptions like:
   - Thinking transactions automatically prevent all data issues
   - Confusing isolation with atomicity
   - Believing higher isolation levels are always better
   - Misunderstanding when locks are acquired vs released

${SHARED_EXPECTATIONS}
    `,
    id: "en-cs-database-transactions-acid",
    userInput: {
      backgroundSteps: [
        {
          text: "Before databases had transactions, a power failure during a bank transfer could leave money in limbo — deducted from one account but never credited to another. Data inconsistency was the norm.",
          title: "The Corruption Problem",
        },
        {
          text: "Jim Gray at IBM tackled this chaos in the 1970s. His insight: group related operations together and guarantee they either all succeed or all fail. No partial states allowed.",
          title: "Gray's Breakthrough",
        },
        {
          text: "The ACID properties emerged as the gold standard for reliable data operations. They transformed databases from fragile systems into ones businesses could trust with critical data.",
          title: "The ACID Standard",
        },
      ],
      chapterTitle: "Data Integrity",
      courseTitle: "Database Systems",
      examplesSteps: [
        {
          text: "Banking transfers are the classic example. Moving $100 from savings to checking must debit one and credit the other atomically — or neither should happen.",
          title: "Banking Transfers",
        },
        {
          text: "E-commerce checkout involves inventory reduction, payment processing, and order creation. All must succeed together, or the customer gets charged without receiving their product.",
          title: "E-commerce Orders",
        },
        {
          text: "Airline booking systems face extreme concurrency — thousands of users trying to book the same seats. Transactions prevent double-booking while maintaining performance.",
          title: "Airline Reservations",
        },
        {
          text: "Social media platforms use transactions for complex operations like posting a photo with tags, location, and notifications — all must be recorded consistently.",
          title: "Social Media Posts",
        },
      ],
      explanationSteps: [
        {
          text: "Atomicity means 'all or nothing.' A transaction either completes entirely or has no effect at all. There's no partial completion — if any part fails, everything rolls back.",
          title: "Atomicity",
        },
        {
          text: "Consistency ensures transactions bring the database from one valid state to another. Rules defined in the schema (like account balance >= 0) are never violated.",
          title: "Consistency",
        },
        {
          text: "Isolation means concurrent transactions don't interfere with each other. Each transaction sees a consistent snapshot, as if it were running alone.",
          title: "Isolation",
        },
        {
          text: "Durability guarantees that once a transaction commits, its changes survive system crashes. The database uses write-ahead logging to ensure committed data isn't lost.",
          title: "Durability",
        },
        {
          text: "Isolation levels trade off between consistency and performance. Serializable is safest but slowest; Read Committed is faster but allows some anomalies.",
          title: "Isolation Levels",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding database transactions and ACID properties for maintaining data integrity in concurrent systems",
      lessonTitle: "Database Transactions and ACID",
      mechanicsSteps: [
        {
          text: "A transaction begins with BEGIN, then executes statements. Changes are held in a buffer, invisible to other transactions until COMMIT makes them permanent.",
          title: "Transaction Lifecycle",
        },
        {
          text: "Write-ahead logging records changes before applying them. If a crash occurs mid-transaction, the log allows the database to either complete or undo the changes during recovery.",
          title: "Write-Ahead Logging",
        },
        {
          text: "Locks prevent concurrent access conflicts. When a transaction modifies a row, it acquires an exclusive lock. Other transactions must wait until the lock releases.",
          title: "Locking Mechanisms",
        },
        {
          text: "Deadlocks occur when two transactions each hold a lock the other needs. The database detects this circular wait and aborts one transaction to break the cycle.",
          title: "Deadlock Detection",
        },
        {
          text: "ROLLBACK undoes all changes made during the transaction. The database uses the log to reverse each operation in the opposite order it was applied.",
          title: "Rollback Process",
        },
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in English.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Economic pricing and market concepts must be accurate. Penalize if:
   - Price discrimination types are incorrectly described
   - Consumer/producer surplus calculations are wrong
   - Elasticity effects are backwards (e.g., claiming inelastic demand means large quantity changes)
   - Market equilibrium mechanics are misrepresented

2. TRANSFER CHECK: The inputs discuss airline tickets, movie theaters, and specific pricing examples. Questions must use completely different scenarios (e.g., concert venues, software licensing, professional services) to test the same concepts.

3. INTEGRATION CHECK: Look for questions that connect WHY price discrimination exists (profit maximization, consumer heterogeneity) with HOW firms segment markets and WHERE different strategies appear.

4. MISCONCEPTION CHECK: Distractors should include common economics misconceptions like:
   - Thinking lower prices always increase revenue
   - Confusing price discrimination with illegal pricing
   - Believing all customers pay the same "fair" price
   - Misunderstanding the relationship between elasticity and pricing power

${SHARED_EXPECTATIONS}
    `,
    id: "en-economics-price-discrimination",
    userInput: {
      backgroundSteps: [
        {
          text: "Why do seniors get discounts while business travelers pay premium? Why does software cost different amounts in different countries? Economists discovered the logic behind seemingly arbitrary pricing.",
          title: "The Pricing Puzzle",
        },
        {
          text: "Arthur Pigou formalized price discrimination theory in the 1920s. He showed that charging different prices to different customers could actually be economically efficient under certain conditions.",
          title: "Pigou's Insight",
        },
        {
          text: "The rise of big data transformed price discrimination from crude segmentation to personalized pricing. Every click, purchase, and search helps companies estimate your willingness to pay.",
          title: "The Data Revolution",
        },
      ],
      chapterTitle: "Pricing Strategy",
      courseTitle: "Microeconomics",
      examplesSteps: [
        {
          text: "Airlines are masters of price discrimination. The same seat costs $200 or $2000 depending on when you book, whether you stay Saturday, and if you're flying for business or leisure.",
          title: "Airline Pricing",
        },
        {
          text: "Movie theaters charge different prices for matinees, seniors, and students. They're segmenting customers by time flexibility and price sensitivity.",
          title: "Movie Tickets",
        },
        {
          text: "Academic software discounts are dramatic — students might pay $50 for software that costs businesses $500. The assumption: students can't afford full price but will become paying customers later.",
          title: "Educational Discounts",
        },
        {
          text: "Happy hour pricing segments customers by time availability. Those who can drink at 4pm are often more price-sensitive than the 8pm crowd willing to pay full price.",
          title: "Happy Hour Economics",
        },
      ],
      explanationSteps: [
        {
          text: "Price discrimination means charging different prices for the same product to different customers. It's not about cost differences — it's about extracting more consumer surplus.",
          title: "Definition",
        },
        {
          text: "First-degree discrimination charges each customer their maximum willingness to pay. It's theoretically perfect but practically impossible without mind-reading. Haggling approximates it.",
          title: "First-Degree",
        },
        {
          text: "Second-degree discrimination offers different versions at different prices. Customers self-select based on their preferences — like choosing between economy and business class.",
          title: "Second-Degree",
        },
        {
          text: "Third-degree discrimination segments customers into groups with different elasticities. Charge more to inelastic groups (business travelers), less to elastic groups (tourists).",
          title: "Third-Degree",
        },
        {
          text: "Price elasticity of demand determines pricing power. If demand barely changes with price (inelastic), firms can charge more. If demand is sensitive (elastic), prices must stay low.",
          title: "Elasticity Connection",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how firms use price discrimination to maximize profits by charging different prices to different customer segments",
      lessonTitle: "Price Discrimination Strategies",
      mechanicsSteps: [
        {
          text: "To price discriminate, a firm must prevent arbitrage — customers who get the low price reselling to those who'd pay more. Physical services naturally prevent this; digital goods require DRM.",
          title: "Preventing Arbitrage",
        },
        {
          text: "Market segmentation identifies groups with different price sensitivities. Age, location, purchase timing, and usage patterns all signal willingness to pay.",
          title: "Segmentation Signals",
        },
        {
          text: "Menu pricing creates product versions that appeal to different segments. The 'basic' version exists partly to make the 'premium' version look valuable by comparison.",
          title: "Menu Design",
        },
        {
          text: "Dynamic pricing adjusts prices in real-time based on demand signals. High demand triggers price increases; low demand triggers discounts. Algorithms optimize continuously.",
          title: "Dynamic Adjustment",
        },
        {
          text: "Bundling combines products to extract more surplus. Cable TV bundles make you pay for channels you don't want because the package captures more total willingness to pay.",
          title: "Bundling Strategy",
        },
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Thermodynamics concepts must be physically accurate. Penalize if:
   - Entropy is described incorrectly (e.g., as "disorder" without nuance about microstates)
   - Heat and temperature are conflated
   - The second law is misstated (e.g., claiming entropy can decrease in closed systems)
   - Energy conservation is misrepresented

2. TRANSFER CHECK: The inputs discuss refrigerators, car engines, and power plants. Questions must use completely different scenarios (e.g., cooking processes, biological systems, weather patterns) to test the same concepts.

3. INTEGRATION CHECK: Look for questions that connect WHY thermodynamics laws exist (fundamental physics constraints) with HOW engines and processes work (energy flows, efficiency limits) and WHERE these principles manifest.

4. MISCONCEPTION CHECK: Distractors should include common thermodynamics misconceptions like:
   - Thinking heat flows from cold to hot spontaneously
   - Confusing thermal equilibrium with equal temperatures for different materials
   - Believing 100% efficient engines are possible
   - Misunderstanding what entropy actually measures

${SHARED_EXPECTATIONS}
    `,
    id: "pt-physics-thermodynamics-laws",
    userInput: {
      backgroundSteps: [
        {
          text: "No seculo XIX, engenheiros queriam construir maquinas a vapor mais eficientes. Sadi Carnot percebeu que havia um limite fundamental — nenhuma maquina poderia converter todo calor em trabalho.",
          title: "O Sonho Impossivel",
        },
        {
          text: "Rudolf Clausius e Lord Kelvin formalizaram as leis da termodinamica. Elas explicam por que o cafe esfria, por que precisamos comer, e por que o universo caminha para a desordem.",
          title: "As Leis Universais",
        },
        {
          text: "A termodinamica e uma das teorias mais robustas da fisica. Einstein disse que, de todas as teorias, ela e a menos provavel de ser derrubada por descobertas futuras.",
          title: "Solidez da Teoria",
        },
      ],
      chapterTitle: "Termodinamica",
      courseTitle: "Fisica Geral",
      examplesSteps: [
        {
          text: "A geladeira e uma bomba de calor que move energia do interior frio para o exterior quente. Isso requer trabalho — por isso ela consome eletricidade continuamente.",
          title: "A Geladeira",
        },
        {
          text: "Motores de carro convertem energia quimica do combustivel em movimento. Mas pelo menos 60-70% da energia e perdida como calor — os limites termodinamicos sao implacaveis.",
          title: "Motores de Combustao",
        },
        {
          text: "Usinas termeletricas queimam combustivel para gerar vapor que move turbinas. A eficiencia tipica e 30-40% — a maior parte da energia se dissipa no ambiente.",
          title: "Geracao de Energia",
        },
        {
          text: "Seu corpo e uma maquina termica. Converte energia dos alimentos em trabalho e calor. Febre significa que o termostato interno foi reconfigurado para uma temperatura mais alta.",
          title: "O Corpo Humano",
        },
      ],
      explanationSteps: [
        {
          text: "A primeira lei diz que energia nao se cria nem se destroi — apenas se transforma. Toda energia que entra em um sistema deve sair ou ser armazenada. E um balanco contabil universal.",
          title: "Primeira Lei",
        },
        {
          text: "A segunda lei afirma que processos espontaneos aumentam a entropia total. Calor flui do quente para o frio naturalmente, nunca ao contrario sem trabalho externo.",
          title: "Segunda Lei",
        },
        {
          text: "Entropia mede a dispersao de energia entre microestados possiveis. Sistemas evoluem para configuracoes mais provaveis — e configuracoes de alta entropia sao vastamente mais provaveis.",
          title: "Entropia",
        },
        {
          text: "Equilibrio termico ocorre quando dois sistemas em contato param de trocar energia liquida. Eles atingem a mesma temperatura, mas nao necessariamente a mesma energia.",
          title: "Equilibrio Termico",
        },
        {
          text: "Calor e a transferencia de energia termica entre sistemas. Temperatura mede a energia cinetica media das moleculas. Calor alto com temperatura baixa e possivel (muito material, movimento lento).",
          title: "Calor vs Temperatura",
        },
      ],
      language: "pt",
      lessonDescription:
        "Compreendendo as leis da termodinamica e como elas governam a transferencia de energia e os limites de eficiencia em todos os processos fisicos",
      lessonTitle: "Leis da Termodinamica",
      mechanicsSteps: [
        {
          text: "Em um motor termico, calor flui da fonte quente para a fria. Parte dessa energia e capturada como trabalho. O resto e desperdicado como calor para o ambiente.",
          title: "Ciclo do Motor Termico",
        },
        {
          text: "O ciclo de Carnot define a eficiencia maxima teorica. Depende apenas das temperaturas das fontes quente e fria. Quanto maior a diferenca, maior a eficiencia possivel.",
          title: "Limite de Carnot",
        },
        {
          text: "Bombas de calor invertem o fluxo natural. Usam trabalho para mover calor do frio para o quente — como a geladeira que remove calor do interior e o despeja no ambiente.",
          title: "Bomba de Calor",
        },
        {
          text: "Processos isotermicos mantem temperatura constante. Processos adiabaticos nao trocam calor com o ambiente. Cada tipo segue equacoes especificas de expansao e compressao.",
          title: "Tipos de Processos",
        },
        {
          text: "A conducao, conveccao e radiacao sao os tres mecanismos de transferencia de calor. Cada um domina em situacoes diferentes — metais conduzem, liquidos convectam, o sol irradia.",
          title: "Mecanismos de Transferencia",
        },
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Social psychology concepts must be accurately represented. Penalize if:
   - Conformity studies are misattributed or misrepresented
   - Obedience and conformity are conflated
   - The role of situational vs dispositional factors is wrong
   - Key experimental findings are incorrectly described

2. TRANSFER CHECK: The inputs discuss Asch's line experiments and Milgram's obedience studies. Questions must use completely different scenarios (e.g., workplace dynamics, online communities, family decisions) to test the same concepts.

3. INTEGRATION CHECK: Look for questions that connect WHY conformity exists (evolutionary benefits, social acceptance) with HOW social pressure operates (unanimity, authority) and WHERE these dynamics appear in modern life.

4. MISCONCEPTION CHECK: Distractors should include common psychology misconceptions like:
   - Thinking conformity only affects weak-willed people
   - Believing obedience experiments wouldn't replicate today
   - Confusing descriptive norms with injunctive norms
   - Underestimating situational power over personality

${SHARED_EXPECTATIONS}
    `,
    id: "es-psychology-social-conformity",
    userInput: {
      backgroundSteps: [
        {
          text: "Despues de la Segunda Guerra Mundial, el mundo pregunto: como pudo gente ordinaria participar en atrocidades? La psicologia social busco entender el poder de la presion grupal sobre la moral individual.",
          title: "La Pregunta Post-Guerra",
        },
        {
          text: "Solomon Asch diseno experimentos elegantes en los 1950s. Mostro que personas inteligentes negaban la evidencia de sus propios ojos cuando un grupo unanime decia lo contrario.",
          title: "Los Estudios de Asch",
        },
        {
          text: "Stanley Milgram llevo esto mas lejos con sus experimentos de obediencia. Revelo que la autoridad percibida podia hacer que personas normales administraran lo que creian eran descargas electricas peligrosas.",
          title: "El Shock de Milgram",
        },
      ],
      chapterTitle: "Influencia Social",
      courseTitle: "Psicologia Social",
      examplesSteps: [
        {
          text: "En reuniones de trabajo, el silencio ante una mala idea se interpreta como acuerdo. La primera persona que habla ancla la discusion, y los demas se conforman por temor a parecer diferentes.",
          title: "Dinamicas de Reunion",
        },
        {
          text: "Las redes sociales amplifican la conformidad. Los 'likes' visibles crean cascadas — contenido popular se vuelve mas popular, no necesariamente porque sea mejor, sino porque otros ya lo aprobaron.",
          title: "Cascadas en Redes",
        },
        {
          text: "La moda demuestra conformidad en accion. Tendencias se propagan porque vestirse diferente tiene costos sociales. La originalidad tiene limites definidos por el grupo.",
          title: "Tendencias de Moda",
        },
        {
          text: "En emergencias medicas, la difusion de responsabilidad hace que nadie actue. Cada persona espera que otro tome la iniciativa, resultando en inaccion colectiva.",
          title: "Efecto Espectador",
        },
      ],
      explanationSteps: [
        {
          text: "La conformidad es el cambio de comportamiento o creencias para coincidir con un grupo. Puede ser externa (actuar igual) o interna (realmente creer lo que el grupo cree).",
          title: "Definicion de Conformidad",
        },
        {
          text: "La influencia normativa surge del deseo de aceptacion social. Nos conformamos para evitar rechazo, incluso cuando sabemos que el grupo esta equivocado.",
          title: "Influencia Normativa",
        },
        {
          text: "La influencia informacional surge cuando usamos al grupo como fuente de informacion. En situaciones ambiguas, asumimos que otros saben mas que nosotros.",
          title: "Influencia Informacional",
        },
        {
          text: "La obediencia es conformidad hacia una autoridad. Difiere de la conformidad horizontal porque hay una jerarquia de poder explicita.",
          title: "Obediencia a la Autoridad",
        },
        {
          text: "Las normas descriptivas describen lo que la gente hace. Las normas prescriptivas describen lo que deberia hacer. Ambas influyen el comportamiento de maneras diferentes.",
          title: "Tipos de Normas",
        },
      ],
      language: "es",
      lessonDescription:
        "Comprendiendo como la presion social y la autoridad influyen en nuestras decisiones, desde situaciones cotidianas hasta dilemas eticos",
      lessonTitle: "Conformidad y Obediencia Social",
      mechanicsSteps: [
        {
          text: "La unanimidad amplifica la conformidad dramaticamente. Un solo disidente reduce la presion a conformarse — no necesitas mayoria, solo alguien que rompa el consenso.",
          title: "El Poder de la Unanimidad",
        },
        {
          text: "La proximidad de la autoridad aumenta la obediencia. En experimentos, la obediencia caia drasticamente cuando el experimentador daba ordenes por telefono en vez de en persona.",
          title: "Proximidad y Autoridad",
        },
        {
          text: "El compromiso gradual atrapa a las personas. Pequenas concesiones llevan a mayores — es mas facil decir 'no' al principio que despues de varios 'si'.",
          title: "Escalada de Compromiso",
        },
        {
          text: "La difusion de responsabilidad ocurre en grupos. Cuando todos son responsables, nadie se siente responsable. Asignar roles especificos contrarresta este efecto.",
          title: "Difusion de Responsabilidad",
        },
        {
          text: "La desindividuacion en grupos reduce la autoconciencia. Anonimato mas excitacion grupal pueden llevar a comportamientos que el individuo solo nunca consideraria.",
          title: "Desindividuacion",
        },
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in English.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Behavioral economics concepts must be accurate. Penalize if:
   - Heuristics are incorrectly described or conflated
   - Loss aversion is confused with risk aversion
   - Framing effects are misrepresented
   - The distinction between System 1 and System 2 thinking is wrong

2. TRANSFER CHECK: The inputs discuss investment decisions and product pricing. Questions must use completely different scenarios (e.g., health choices, environmental behavior, relationship decisions) to test the same concepts.

3. INTEGRATION CHECK: This is an interdisciplinary topic. Look for questions that connect WHY biases exist (evolutionary psychology, cognitive limitations) with HOW they operate (heuristics, framing) and WHERE they affect decisions across domains.

4. MISCONCEPTION CHECK: Distractors should include common behavioral economics misconceptions like:
   - Thinking biases only affect unintelligent people
   - Believing awareness of bias eliminates its effect
   - Confusing heuristics (shortcuts) with errors (biases)
   - Assuming rational choice theory accurately predicts behavior

${SHARED_EXPECTATIONS}
    `,
    id: "en-interdisciplinary-behavioral-economics",
    userInput: {
      backgroundSteps: [
        {
          text: "Classical economics assumed people are rational utility maximizers. But psychologists Daniel Kahneman and Amos Tversky documented systematic patterns where humans deviate from rationality in predictable ways.",
          title: "The Rationality Assumption",
        },
        {
          text: "Their research earned Kahneman the 2002 Nobel Prize in Economics — the first psychologist to win it. Behavioral economics was born from this collision of psychology and economic theory.",
          title: "A Nobel-Winning Collision",
        },
        {
          text: "Richard Thaler expanded these insights into practical applications. His concept of 'nudging' showed how small changes in choice architecture could improve decisions without restricting freedom.",
          title: "From Theory to Practice",
        },
      ],
      chapterTitle: "Decision Making",
      courseTitle: "Behavioral Economics",
      examplesSteps: [
        {
          text: "Investors hold losing stocks too long and sell winners too early. Loss aversion makes the pain of realizing a loss feel worse than the pleasure of locking in a gain.",
          title: "Investment Behavior",
        },
        {
          text: "Stores price items at $9.99 instead of $10 because our brains anchor on the left digit. This 'left-digit bias' affects perception more than the actual penny saved.",
          title: "Pricing Psychology",
        },
        {
          text: "Gym memberships exploit present bias — we overestimate future motivation when signing up, then fail to attend. The gym profits from our systematic overconfidence about future behavior.",
          title: "Gym Economics",
        },
        {
          text: "Default options are powerful. Countries with opt-out organ donation have 90%+ participation; opt-in countries have 15%. Same choice, different framing, vastly different outcomes.",
          title: "Default Effects",
        },
      ],
      explanationSteps: [
        {
          text: "Loss aversion means losses hurt roughly twice as much as equivalent gains feel good. This asymmetry explains why people take irrational risks to avoid losses but not to achieve gains.",
          title: "Loss Aversion",
        },
        {
          text: "Anchoring occurs when we rely too heavily on the first piece of information encountered. An arbitrary initial number influences subsequent estimates, even when unrelated to the judgment.",
          title: "Anchoring Bias",
        },
        {
          text: "Present bias leads us to overweight immediate rewards compared to future ones. We know we should save for retirement, but the pleasure of spending now feels more real.",
          title: "Present Bias",
        },
        {
          text: "Framing effects mean how a choice is presented affects decisions. '90% survival rate' sounds better than '10% mortality rate' — identical information, different emotional response.",
          title: "Framing Effects",
        },
        {
          text: "System 1 thinking is fast, automatic, and intuitive. System 2 is slow, deliberate, and analytical. Most decisions use System 1, which is efficient but prone to biases.",
          title: "Dual Systems",
        },
      ],
      language: "en",
      lessonDescription:
        "Understanding how cognitive biases and heuristics systematically influence economic decisions, and how choice architecture can improve outcomes",
      lessonTitle: "Behavioral Economics Foundations",
      mechanicsSteps: [
        {
          text: "Heuristics are mental shortcuts that usually work but sometimes fail. Availability heuristic: judging probability by how easily examples come to mind, not actual frequency.",
          title: "Heuristics in Action",
        },
        {
          text: "Choice architecture structures how options are presented. The default, number of options, and order of presentation all influence which option people choose.",
          title: "Choice Architecture",
        },
        {
          text: "Nudges are subtle changes that steer behavior without forbidding options. Putting healthy food at eye level in cafeterias is a nudge — junk food is still available but less convenient.",
          title: "Nudge Mechanics",
        },
        {
          text: "Commitment devices help overcome present bias. Automatic savings deductions work because they make the rational future choice before present bias can override it.",
          title: "Commitment Devices",
        },
        {
          text: "Social proof leverages conformity for behavior change. Telling hotel guests that 'most guests reuse towels' increases reuse more than environmental appeals alone.",
          title: "Social Proof Nudges",
        },
      ],
    },
  },
];
