import { type TestCase } from "@/lib/types";
import { type CourseOutlineParams } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type CourseOutlineExpected } from "./scorer";

const SHARED_EXPECTATIONS = `
  - The output is one level band of a shared course: chapters (title, description, objectives, skillKeys, tools) with every lesson's title, description, can-do line, estimated minutes and skills, plus uncoveredSkillKeys (required skills no chapter tagged)
  - A chapter's tools are what the learner uses on their own device; code checks score them, so don't judge them
  - A non-empty uncoveredSkillKeys means a required skill was missed
  - The outline is shared by every learner of this course level, so it must not be tailored to one person
  - Don't evaluate JSON formatting
`;

export const TEST_CASES: TestCase<CourseOutlineExpected, CourseOutlineParams>[] = [
  {
    expectations: `
      - MUST be in US English
      - Overview for a curious adult, in plain words with no formulas, covering the required skills
      - The learners already learn the TAUGHT_ELSEWHERE skills (the uncertainty principle, how measuring changes a quantum system, describing entanglement) in lessons from another course: no lesson teaches them again, even under another name (no "Quantum measurement" or "What entanglement is" lesson), and no chapter is named after them
      - A chapter next to those topics covers only what's still missing (such as Bell tests or why entanglement can't send messages)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-quantum-overview-taught-elsewhere",
    userInput: {
      courseTitle: "Quantum physics",
      language: "en",
      level: "overview",
      requiredSkills: [
        {
          description:
            "Describe a quantum state as the full list of possible outcomes and their chances.",
          key: "quantum-states",
          name: "Describe quantum states",
        },
        {
          description: "Explain why quantum outcomes are chances, not hidden fixed values.",
          key: "quantum-probabilities",
          name: "Explain quantum probabilities",
        },
        {
          description:
            "Explain why entangled particles can't be used to send a message faster than light.",
          key: "no-signaling",
          name: "Distinguish entanglement from instant messaging",
        },
        {
          description: "Say what Bell tests check and what their results showed.",
          key: "bell-tests",
          name: "Interpret the purpose of Bell tests",
        },
      ],
      taughtElsewhere: [
        "Explain the uncertainty principle",
        "Explain how measuring changes a quantum system",
        "Describe entanglement",
      ],
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Overview for a curious adult: 3 to 6 chapters, plain words, no formulas, equations or notation
      - Big ideas, judged by category rather than by any one example: the quantum foundations (quantization, wave-particle duality, uncertainty, superposition and measurement), what quantum physics says about atoms and matter, entanglement, and at least one modern application of quantum effects (a technology people use, or quantum computing)
      - Lessons are short stories about one idea each, not a textbook sequence

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-quantum-physics-overview",
    userInput: { courseTitle: "Quantum physics", language: "en", level: "overview" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Overview: 3 to 6 chapters of big ideas in plain words, no formulas or equations
      - Big ideas, judged by category rather than by any one example: scarcity and choices; markets and prices; the financial system (money, banks and credit); core ideas of macroeconomics such as output, growth, inflation, unemployment and public finances; trade with other countries; and how people actually decide. Brazilian examples are welcome

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-economia-overview",
    userInput: { courseTitle: "Economia", language: "pt", level: "overview" },
  },
  {
    expectations: `
      - MUST be in US English
      - Beginner band of classical mechanics: describing motion (position, velocity, acceleration, vectors), Newton's laws and free-body diagrams, friction, circular motion, work and energy and its conservation, momentum and collisions, rotation and torque, gravity and orbits, oscillations and simple harmonic motion
      - Every required skill key must be tagged on the chapter that teaches it: describe-motion, newtons-laws, energy-conservation, momentum, simple-harmonic-motion
      - Calculus-based derivations can appear only as far as a beginner band needs; Lagrangian and Hamiltonian mechanics belong to later bands

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-classical-mechanics-beginner-required",
    userInput: {
      courseTitle: "Classical mechanics",
      language: "en",
      level: "beginner",
      requiredSkills: [
        {
          description: "Use position, velocity and acceleration to describe how things move.",
          key: "describe-motion",
          name: "Describe motion with vectors",
        },
        {
          description: "Predict motion from the forces acting on an object.",
          key: "newtons-laws",
          name: "Apply Newton's laws",
        },
        {
          description: "Track kinetic and potential energy as an object moves.",
          key: "energy-conservation",
          name: "Use conservation of energy",
        },
        {
          description: "Use momentum to predict what happens in collisions.",
          key: "momentum",
          name: "Solve collisions with momentum",
        },
        {
          description: "Describe springs and pendulums with periodic motion.",
          key: "simple-harmonic-motion",
          name: "Model simple harmonic motion",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Beginner band of statistics, judged by category rather than by any one example: describing data (types of variables, tables and charts, center, spread and position), probability and distributions at a beginner level, sampling and bias, relationships between variables (correlation is not causation), and a first look at inference (estimation and hypothesis testing)
      - Level fit: inference stays at a beginner's first look; several separate test procedures (t tests for different designs, ANOVA, chi-square) go past the band and are a level-fit error
      - Practical work with spreadsheets and real data should appear, and a field AI is changing should include checking analyses and charts made with AI tools
      - Formulas may appear where the idea needs them, explained in everyday words

      ${SHARED_EXPECTATIONS}
    `,
    expected: { tool: "planilha|excel|sheets|calc" },
    id: "pt-estatistica-beginner",
    userInput: { courseTitle: "Estatística", language: "pt", level: "beginner" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Beginner band of UX design for career changers: research, problem framing, information architecture, interaction, visual design, prototyping, testing and the work with a product team
      - No two lessons of a chapter teach the same distinction: "a need is not a product goal", "a goal is not a solution" and "a solution is not a result" belong in one lesson; "a symptom is not a problem" and "a symptom is not its cause" too. Each lesson has its own move: a new idea, a procedure, a harder case or applying earlier ideas together

      ${SHARED_EXPECTATIONS}
    `,
    expected: { tool: "figma|figjam|penpot" },
    id: "pt-ux-beginner-distinct-lessons",
    userInput: { courseTitle: "Design de UX", language: "pt", level: "beginner" },
  },
  {
    expectations: `
      - MUST be in Spain Spanish (not Latin American Spanish), for example "ordenador" and "fichero" or "archivo" in their European use
      - Beginner band of Python programming: running Python and the tools to write it, variables and types, strings, conditionals, loops, functions, lists, dictionaries and other collections, reading and writing files, errors and exceptions, modules and packages, virtual environments, basic testing, and a small real program
      - Programming is a field AI is changing: lessons must include working with AI assistants (describing a task, reading and reviewing generated code, finding the bug in AI code) and favor concepts and debugging over memorizing syntax

      ${SHARED_EXPECTATIONS}
    `,
    expected: { tool: "python" },
    id: "es-python-beginner",
    userInput: { courseTitle: "Programación en Python", language: "es", level: "beginner" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - This is a continuation, not a band: the course already teaches the EXTEND_SKILLS skill in the listed chapter, and the answer must be exactly one new chapter for it, tagged with its key, with about 8 lessons. Judge coverage, order and level fit on that one chapter, not on a whole band
      - The new chapter continues where the listed lessons stop, at a beginner (A1 to A2) English level, for Portuguese speakers: new interview situations and language (such as talking about strengths, a problem solved at work, why they want the job, questions to ask the interviewer), repeating none of the listed lessons, even under another name
      - Its title is its own scope in Brazilian Portuguese, never "Candidaturas e entrevistas" or a "Parte 2", "Mais…" or "Avançado" variant of it, and it doesn't repeat any title in OTHER_LEVEL_CHAPTERS
      - Lessons stay situations with English the learner says or understands, not grammar lectures

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles-beginner-extend-interview",
    userInput: {
      courseTitle: "Inglês",
      extendSkills: [
        {
          chapters: [
            {
              lessons: [
                "Passado simples para experiência profissional",
                "Formação acadêmica e profissional",
                "Tarefas e responsabilidades anteriores",
                "Perguntas comportamentais de entrevista",
                "Marcadores de tempo na experiência profissional",
              ],
              title: "Candidaturas e entrevistas",
            },
          ],
          description: "Falar sobre empregos anteriores, formação e responsabilidades em inglês.",
          key: "descrever-experiencia",
          lessons: 8,
          name: "Descrever experiência profissional",
        },
      ],
      language: "pt",
      level: "beginner",
      otherLevelChapters: [
        "Primeiras conversas",
        "Apresentações e dados pessoais",
        "Candidaturas e entrevistas",
        "Comunicação cotidiana no trabalho",
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Beginner band of a canonical mathematics course from zero, judged by category rather than by any one example: numbers and operations (whole numbers, fractions, decimals, powers and roots), proportional reasoning (ratio, proportion, percentages), first algebra (expressions, linear equations, first-degree functions), measurement and plane geometry, and reading data (charts, tables, basic statistics)
      - Level fit: content past a from-zero beginner band (quadratic functions, trigonometry, analytic geometry) is a level-fit error
      - Every required skill key must be tagged on the chapter that teaches it: porcentagem, razao-proporcao, leitura-graficos, estatistica-basica, geometria-plana, funcao-afim
      - Shared by all learners: exam-specific tricks for ENEM don't belong in a canonical course outline

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-matematica-beginner-enem-skills",
    userInput: {
      courseTitle: "Matemática",
      language: "pt",
      level: "beginner",
      requiredSkills: [
        {
          description: "Calcular aumentos, descontos e partes de um todo.",
          key: "porcentagem",
          name: "Calcular porcentagens",
        },
        {
          description: "Comparar grandezas e resolver regras de três.",
          key: "razao-proporcao",
          name: "Resolver problemas de proporção",
        },
        {
          description: "Tirar conclusões de gráficos e tabelas.",
          key: "leitura-graficos",
          name: "Interpretar gráficos e tabelas",
        },
        {
          description: "Resumir dados com média, mediana e moda.",
          key: "estatistica-basica",
          name: "Calcular média, mediana e moda",
        },
        {
          description: "Calcular áreas e perímetros de figuras planas.",
          key: "geometria-plana",
          name: "Calcular áreas de figuras planas",
        },
        {
          description: "Modelar situações com funções do primeiro grau.",
          key: "funcao-afim",
          name: "Usar funções do primeiro grau",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Intermediate band of a shared speech recognition and transcription course; the learners who need the required skills prepare for a public-service exam answered on paper (certo/errado items), so WITHOUT_TOOLS is yes
      - Every required skill is tagged on a chapter that teaches it the way such an exam asks it: how automatic speech recognition works and where it fails (acoustic and language models, word error rate), what end-to-end models change (CTC, attention, transducers), what multimodal audio LLMs do differently, how speaker diarization works (segmentation, speaker embeddings, clustering, overlap) and its limits, with no tools on those chapters
      - The band may still have practice chapters with tools for other learners, but no required skill is tagged only on one, and none of the required skills is taught as a job task (choosing replay ranges, editing audio)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-fala-intermediate-written-exam",
    userInput: {
      courseTitle: "Reconhecimento de Fala e Transcrição",
      language: "pt",
      level: "intermediate",
      requiredSkills: [
        {
          description:
            "Explicar como um sistema de reconhecimento automático de fala converte áudio em texto e onde erra.",
          key: "asr",
          name: "Explicar o reconhecimento automático de fala",
        },
        {
          description: "Distinguir modelos de fala de ponta a ponta das arquiteturas em etapas.",
          key: "end-to-end",
          name: "Comparar modelos de fala end-to-end",
        },
        {
          description: "Avaliar o que LLMs multimodais de áudio nativo fazem e seus limites.",
          key: "multimodal",
          name: "Avaliar LLMs multimodais de áudio",
        },
        {
          description: "Explicar como a diarização identifica e separa falantes e onde falha.",
          key: "diarizacao",
          name: "Explicar a diarização de falantes",
        },
      ],
      withoutTools: true,
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Intermediate band of a shared English course whose required skills are needed by candidates of the exam in EXAMS, who read English texts at B1 to B2 and judge statements about them as right or wrong
      - The chapters that teach the required skills are written at that depth: lessons on reading news reports, institutional and academic texts (whose claim a sentence is, whether the author endorses or only reports it, hedges and reporting verbs, reference across sentences, inference and the author's stance), never on recognizing quotation marks, who said a one-line sentence or everyday scenes
      - No title, description or objective names the exam, its board or its notice ("Câmara dos Deputados", "Cebraspe", "concurso", "edital")
      - Every required skill is tagged on a chapter without tools

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles-intermediate-exam-reading",
    userInput: {
      courseTitle: "Língua inglesa",
      exams: [
        {
          name: "Concurso Câmara dos Deputados, Analista Legislativo - Registro e Redação",
          style:
            "trueFalse: Itens julgados CERTO ou ERRADO. essay: Duas questões discursivas sobre conhecimentos específicos, com até 20 linhas cada.",
        },
      ],
      language: "pt",
      level: "intermediate",
      requiredSkills: [
        {
          description:
            "Distinguir, em textos em inglês, o que o autor afirma do que ele atribui a outras fontes.",
          key: "atribuicao",
          name: "Identificar a quem pertence uma afirmação",
        },
        {
          description: "Inferir a posição do autor a partir de escolhas de palavras e ressalvas.",
          key: "posicao-autor",
          name: "Inferir a posição do autor de um texto",
        },
        {
          description: "Reconhecer a que se referem pronomes e expressões ao longo de um texto.",
          key: "referencia",
          name: "Reconhecer o referente de pronomes e expressões",
        },
      ],
      withoutTools: true,
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - A private course built from one first-year high-school student's own class summary (MATERIAL) for a test on Friday: the outline teaches exactly that summary, in its order and at its depth, with its terms (teoria celular, procariontes e eucariontes, membrana e transportes com osmose e bomba de sódio e potássio, organelas e suas funções, célula animal e vegetal, núcleo)
      - Nothing beyond the material except what one of its ideas needs: no glycocalyx, secondary active transport, respiratory chain, endosymbiosis, nuclear lamina or nuclear pore transport, and no cell division, which the summary says isn't on the test
      - The summary's exam-style exercises (procarionte ou eucarionte, a red cell in distilled water, matching organelles to functions, animal vs plant differences) are reflected in what lessons prepare the learner to do
      - The band is small, like the summary: a few chapters, not a whole university course

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-material-class-test",
    userInput: {
      courseTitle: "Biologia celular",
      language: "pt",
      level: "intermediate",
      material: `<page ref="S1" of="Resumo para a prova">
Biologia 1º ano B - Prof.ª Juliana - Resumo para a prova de sexta (9/10): A CÉLULA
1. Teoria celular: todos os seres vivos são formados por células (vírus são acelulares). A célula é a menor unidade estrutural e funcional. Toda célula vem de outra preexistente (Virchow). Hooke (1665) observou cortiça.
2. Procariontes (bactérias e arqueas): sem núcleo organizado (nucleoide), sem organelas membranosas, têm ribossomos, membrana e parede. Eucariontes: núcleo com carioteca e organelas membranosas. CAI NA PROVA: ribossomos existem nos dois!
3. Membrana plasmática: mosaico fluido (Singer e Nicolson, 1972), bicamada de fosfolipídios com proteínas, permeabilidade seletiva. Passivo (sem ATP): difusão simples, facilitada, osmose (água vai do hipotônico para o hipertônico). Ativo (com ATP): bomba de sódio e potássio (3 Na+ para fora, 2 K+ para dentro). Endocitose (fagocitose, pinocitose) e exocitose.
4. Organelas: mitocôndria (respiração celular, ATP, DNA próprio); cloroplasto (fotossíntese, só plantas e algas, DNA próprio); ribossomo (síntese de proteínas); RE rugoso (proteínas) e liso (lipídios, desintoxicação); complexo golgiense (modifica, empacota, secreta; acrossomo); lisossomo (digestão intracelular); vacúolo central (vegetal); centríolos (divisão nas animais).
5. Animal x vegetal: vegetal tem parede de celulose, cloroplastos, vacúolo central grande, geralmente sem centríolos; animal sem parede, sem cloroplastos, com centríolos.
6. Núcleo: carioteca com poros, cromatina (DNA + proteínas), nucléolo (forma ribossomos).
Exercícios (estilo da prova): 1) Célula com parede, ribossomos e sem núcleo organizado: procarionte ou eucarionte? Justifique. 2) Por que uma hemácia em água destilada pode se romper? Use hipotônico e hipertônico. 3) Relacione mitocôndria, lisossomo, complexo golgiense, ribossomo com digestão, secreção, ATP, proteínas. 4) Duas diferenças entre célula animal e vegetal.
Obs.: a prova tem 5 questões abertas e 5 de marcar. Não cai divisão celular (mitose fica para o próximo bimestre).
</page>`,
      requiredSkills: [
        {
          description: "Aplicar os postulados da teoria celular.",
          key: "teoria-celular",
          name: "Aplicar a teoria celular",
        },
        {
          description: "Distinguir células procariontes e eucariontes pela organização.",
          key: "procariontes",
          name: "Diferenciar procariontes e eucariontes",
        },
        {
          description: "Explicar o transporte passivo e ativo pela membrana, incluindo a osmose.",
          key: "membrana",
          name: "Explicar os transportes pela membrana",
        },
        {
          description: "Relacionar cada organela à sua função.",
          key: "organelas",
          name: "Relacionar organelas e funções",
        },
      ],
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Intermediate band of a shared ENEM course, from a real run (10 Oct 2026) that put Portuguese text lessons, math chart lessons and physics wave lessons in one chapter ("Painéis visuais e representações de ondas") and joined Linguagens with Ciências Humanas in another
      - Every chapter's tagged skills share one area (each skill's \`area\`), and every lesson of a chapter belongs to that area: no text or map lessons in a chapter tagged with a math or physics skill
      - Each EXTEND_SKILLS skill gets one new chapter that continues its listed chapters without repeating their lessons
      - No title, description or objective names the exam ("ENEM")

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-enem-intermediate-one-area-per-chapter",
    userInput: {
      courseTitle: "ENEM",
      exams: [
        {
          name: "ENEM",
          style:
            "multipleChoice (5 options): Múltipla escolha com cinco alternativas, de A a E essay: Redação dissertativo-argumentativa de até 30 linhas Teoria de Resposta ao Item: um acerto vale mais quando o padrão de respostas é coerente.",
        },
      ],
      extendSkills: [
        {
          area: "Ciências da Natureza",
          chapters: [
            {
              lessons: [
                "Raio atômico e posição periódica",
                "Energia de ionização e eletronegatividade",
                "Ligação iônica e propriedades",
                "Ligações covalentes e metálicas",
              ],
              title: "Propriedades periódicas e ligações",
            },
            {
              lessons: [
                "Grupos, períodos e elétrons externos",
                "Raio atômico e raio iônico",
                "Tendências da energia de ionização",
                "Eletronegatividade na tabela periódica",
              ],
              title: "Tendências e comparações periódicas",
            },
            {
              lessons: [
                "Blindagem eletrônica e carga nuclear efetiva",
                "Energias de ionização sucessivas",
                "Afinidade eletrônica",
                "Estabilidade de subníveis e exceções periódicas",
                "Caráter metálico na tabela periódica",
                "Reatividade dos metais alcalinos",
                "Reatividade dos halogênios",
                "Caráter ácido e básico de óxidos",
                "Polarizabilidade de íons",
                "Tendências nos metais de transição",
              ],
              title: "Exceções e reatividade na tabela periódica",
            },
          ],
          description:
            "Usar a organização periódica para comparar características e propriedades dos elementos.",
          key: "01a122ed-b691-70ed-bd88-151e261d77fa",
          lessons: 6,
          name: "Comparar propriedades periódicas",
        },
        {
          area: "Ciências da Natureza",
          chapters: [
            {
              lessons: [
                "Raio atômico e posição periódica",
                "Energia de ionização e eletronegatividade",
                "Ligação iônica e propriedades",
                "Ligações covalentes e metálicas",
              ],
              title: "Propriedades periódicas e ligações",
            },
            {
              lessons: [
                "Geometria molecular e repulsão eletrônica",
                "Pares não ligantes e forma molecular",
                "Polaridade molecular e simetria",
                "Forças de dispersão e polarizabilidade",
                "Interações dipolo-dipolo",
                "Ligações de hidrogênio entre moléculas",
                "Forças intermoleculares e temperatura de ebulição",
                "Viscosidade e tensão superficial",
                "Sólidos cristalinos e amorfos",
                "Polimorfismo cristalino",
              ],
              title: "Forma molecular e organização das partículas",
            },
          ],
          description: "Distinguir ligações iônicas, covalentes e metálicas",
          key: "01a12220-bb3f-70cc-be04-8e001d907327",
          lessons: 10,
          name: "Relacionar ligações e propriedades",
        },
        {
          area: "Matemática",
          chapters: [
            { lessons: ["Leitura de gráficos"], title: "Estatística" },
            {
              lessons: [
                "Eixos truncados",
                "Valores absolutos e proporções",
                "Gráficos acumulados",
                "Gráficos com dois eixos verticais",
                "Séries indexadas",
                "Pictogramas e proporção visual",
              ],
              title: "Comparações e distorções em gráficos",
            },
            {
              lessons: [
                "Tabelas de características biológicas",
                "Bactérias, arqueias e eucariontes",
                "Diversidade dos eucariontes",
                "Grupos de plantas",
                "Grupos de animais",
                "Cladogramas e parentesco",
                "Mapas de calor",
                "Gráficos de dispersão",
                "Diagrama de caixa",
                "Barras de erro em gráficos",
              ],
              title: "Dados de biodiversidade e classificação",
            },
          ],
          description:
            "Leia o título, os eixos e as unidades antes dos números, e só então compare o que a questão pede.",
          key: "588e45be-560f-86b2-824c-bb3c0479f598",
          lessons: 10,
          name: "Ler gráficos e tabelas",
        },
        {
          area: "Linguagens",
          chapters: [
            {
              lessons: [
                "Variação regional, social e situacional",
                "Norma-padrão e preconceito linguístico",
                "Escolha lexical e posicionamento",
                "Marcas lexicais de avaliação",
              ],
              title: "Variação linguística e escolhas lexicais",
            },
            {
              lessons: [
                "Alternância de registro",
                "Escrita digital e situação de uso",
                "Oralidade representada na escrita",
                "Variação geracional",
                "Contato entre variedades regionais",
                "Linguagem de grupos e pertencimento",
                "Empréstimos linguísticos",
                "Línguas indígenas e português brasileiro",
                "Variedades linguísticas na ficção",
                "Variação linguística e registro formal",
              ],
              title: "Língua em contato e situações de uso",
            },
          ],
          description:
            "Identificar variedades da língua portuguesa e explicar sua relação com grupos e situações de uso.",
          key: "01a122ed-ade1-7368-91ad-a81e1c90aff0",
          lessons: 10,
          name: "Reconhecer variação linguística",
        },
        {
          area: "Ciências Humanas",
          chapters: [
            { lessons: ["A Primeira República"], title: "Brasil República" },
            {
              lessons: [
                "Os limites da alternância presidencial",
                "Interesses de São Paulo e Minas Gerais",
                "A Primeira República",
                "A Reação Republicana de 1922",
                "A disputa pela sucessão de 1930",
                "Aliança Liberal e ruptura de 1930",
              ],
              title: "Acordos e rupturas das oligarquias",
            },
            {
              lessons: [
                "Federalismo e poder estadual",
                "Limites do direito ao voto",
                "Clientelismo e apoio político",
                "Voto aberto e pressão sobre eleitores",
                "Fraudes na apuração",
                "Verificação de poderes e degola",
                "A cadeia de apoio da política dos governadores",
                "Convênio de Taubaté e sustentação dos preços",
                "Custos públicos da valorização do café",
                "Fontes eleitorais e alcance do controle oligárquico",
              ],
              title: "Engrenagens do domínio oligárquico",
            },
          ],
          description:
            "De 1894 a 1930, as elites de São Paulo e Minas Gerais dominaram a presidência, muitas vezes se alternando.",
          key: "c3f3f373-5fcb-89f3-8dd5-6bdb196e5dcb",
          lessons: 10,
          name: "Explicar a política do café com leite",
        },
        {
          area: "Redação",
          chapters: [
            { lessons: ["As cinco competências"], title: "Redação" },
            {
              lessons: [
                "Desvios de norma na competência I",
                "Recorte temático na competência II",
                "Sustentação argumentativa na competência III",
                "Relações de sentido na competência IV",
                "Elementos da intervenção na competência V",
                "Problemas simultâneos em um trecho",
              ],
              title: "Diagnóstico das competências da redação",
            },
            {
              lessons: [
                "Recorrência de desvios na competência I",
                "Variação linguística e registro formal",
                "Repertório produtivo na competência II",
                "Uso dos textos motivadores",
                "Sustentação argumentativa na competência III",
                "Desenvolvimento de exemplos",
                "Ambiguidade na referência",
                "Conectivos e relações efetivas",
                "Elementos da intervenção na competência V",
                "Direitos humanos na proposta de intervenção",
              ],
              title: "Calibração das competências da redação",
            },
          ],
          description:
            "A redação vale cinco competências, de 0 a 200 cada: norma culta, tema, argumentação, coesão e proposta de intervenção.",
          key: "5dbcc48f-5cf6-8de9-88af-5ff186e54f50",
          lessons: 10,
          name: "Conhecer as cinco competências da redação",
        },
      ],
      language: "pt",
      level: "intermediate",
      otherLevelChapters: [
        "Porcentagem",
        "Funções",
        "Cadeias de reajustes percentuais",
        "Modelos lineares em tarifas e faixas",
        "Otimização quadrática com restrições",
        "Preço final em ofertas com condições",
        "Estatística",
        "Desconto real em compras por quantidade",
        "Percentuais além dos casos inteiros",
        "Medidas centrais em conjuntos de dados",
        "Fatores percentuais em valores compostos",
        "Comparações e distorções em gráficos",
        "Razão e proporção",
        "Dados de biodiversidade e classificação",
        "Ecologia",
        "Proporcionalidade inversa e composta",
        "Escalas em mapas, plantas e maquetes",
        "Ecologia: Destinos da energia nas teias alimentares",
        "Ecologia: Estimativas de energia em teias alimentares",
        "Eletricidade",
        "Eletricidade: Tensões e falhas em circuitos série",
        "Lei de Ohm em gráficos e circuitos",
        "Brasil República",
        "Brasil República: Conflitos e queda do Estado Novo",
        "Acordos e rupturas das oligarquias",
        "Engrenagens do domínio oligárquico",
        "Interpretação de texto",
        "Inferência, coesão e vozes textuais",
        "Foco textual e pertinência do repertório",
        "Uso crítico de repertório na argumentação",
        "Inferências em argumentos e vozes do texto",
        "Redação",
        "Coerência e escolhas no fechamento da redação",
        "Proposta de intervenção detalhada",
        "Diagnóstico das competências da redação",
        "Calibração das competências da redação",
        "Medidas e movimento",
        "Precisão de medidas e chances em experimentos",
        "Unidades em situações e gráficos físicos",
        "Escalas e unidades em medidas especializadas",
        "Propriedades periódicas e ligações",
        "Tendências e comparações periódicas",
        "Exceções e reatividade na tabela periódica",
        "Forma molecular e organização das partículas",
        "Variação linguística e escolhas lexicais",
        "Língua em contato e situações de uso",
        "Recursos linguísticos e efeitos de sentido",
        "Nomeação e enquadramento lexical",
        "Decisão entre alternativas",
      ],
      requiredSkills: [
        {
          area: "Linguagens",
          description:
            "Relacionar palavras, imagens e outros recursos para interpretar textos de diferentes gêneros.",
          key: "01a1221f-40fc-77ad-a11d-d8a466e14767",
          name: "Interpretar textos multimodais",
        },
        {
          area: "Ciências da Natureza",
          description:
            "Relacionar frequência, comprimento de onda e velocidade à propagação de oscilações e ondas.",
          key: "01a122ed-b690-7ea1-9fb6-54fea3ff6c5d",
          name: "Analisar a propagação de ondas",
        },
        {
          area: "Ciências da Natureza",
          description:
            "Usar modelos atômicos e partículas subatômicas para explicar a constituição da matéria.",
          key: "01a122ed-b690-7fcc-ac2b-e84e1fa28d64",
          name: "Interpretar modelos atômicos",
        },
        {
          area: "Ciências Humanas",
          description:
            "Comparar a produção agrária e outras formas de organização do trabalho segundo a propriedade, a técnica e as relações sociais.",
          key: "01a122ed-ade3-73bd-bf80-6754435d94ab",
          name: "Comparar sistemas produtivos e relações de trabalho",
        },
        {
          area: "Ciências Humanas",
          description:
            "Relacionar identidades culturais, costumes e formas de convivência às condições históricas em que se formam.",
          key: "01a122ed-ade1-73b4-a3ab-d158ba1de158",
          name: "Analisar a formação de identidades culturais",
        },
      ],
      withoutTools: true,
    },
  },
];
