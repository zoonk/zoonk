const SHARED_EXPECTATIONS = `
  - Chapters should be 3-7 words long
  - Should build upon basic level knowledge with more complex concepts
  - Should include practical applications and real-world examples
  - Should prepare learners for senior-level positions
  - Should NOT include personalized content like "Build Your Own X", "Final Project"
  - Should NOT repeat chapters from basic level
  - Should use modern terminology and everyday language
  - Should be split into granular topics
  - Should follow the language specified by locale parameter
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST build upon basic Python knowledge (assume they know syntax, functions, data structures)
      - MUST cover advanced topics: OOP, decorators, generators, context managers
      - SHOULD include chapters on testing, debugging, performance optimization
      - SHOULD cover popular frameworks/libraries (Django/Flask, NumPy/Pandas, or similar)
      - SHOULD introduce design patterns and best practices
      - MUST be in English
      - Should prepare for senior developer roles
      - Should have 12-18 chapters covering intermediate concepts thoroughly

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-python-programming",
    userInput: {
      courseTitle: "Python Programming",
      locale: "en",
      previousChapters: [
        "Variables and Data Types",
        "Control Structures",
        "Functions",
        "Lists and Tuples",
        "Dictionaries and Sets",
        "File Operations",
        "Error Handling",
        "Modules and Packages",
        "String Manipulation",
        "Basic OOP Concepts",
        "Working with APIs",
        "Python Ecosystem",
        "Debugging Basics",
        "Version Control with Git",
        "Career Paths in Python",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon basic web development (assume they know HTML, CSS, basic JS)
      - MUST cover JavaScript frameworks (React, Vue, or Angular)
      - SHOULD include chapters on build tools, bundlers, package managers
      - SHOULD cover responsive design patterns and CSS frameworks
      - SHOULD introduce browser APIs and modern web features
      - MUST be in Portuguese (Brazil)
      - Should cover performance optimization and SEO basics
      - Should NOT repeat basic HTML/CSS concepts

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-desenvolvimento-web",
    userInput: {
      courseTitle: "Desenvolvimento Web",
      locale: "pt",
      previousChapters: [
        "Estrutura HTML Básica",
        "Tags HTML Essenciais",
        "CSS e Seletores",
        "Box Model",
        "Flexbox",
        "Grid Layout",
        "Design Responsivo",
        "JavaScript Básico",
        "DOM Manipulation",
        "Eventos",
        "Formulários Web",
        "Acessibilidade Web",
        "Hospedagem e Deploy",
        "Ferramentas de Desenvolvedor",
        "Carreira em Desenvolvimento Web",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon basic chemistry (assume knowledge of atoms, bonds, reactions)
      - MUST cover organic chemistry fundamentals
      - SHOULD include chapters on chemical kinetics and equilibrium
      - SHOULD cover analytical techniques and instrumentation
      - SHOULD introduce thermodynamics and electrochemistry
      - MUST be in Spanish
      - Should prepare for lab analyst or research assistant roles
      - Should include industrial applications

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-basica",
    userInput: {
      courseTitle: "Química Básica",
      locale: "es",
      previousChapters: [
        "Estructura Atómica",
        "Tabla Periódica",
        "Enlaces Químicos",
        "Estados de la Materia",
        "Reacciones Químicas",
        "Estequiometría",
        "Soluciones y Concentraciones",
        "Ácidos y Bases",
        "Seguridad en el Laboratorio",
        "Técnicas de Laboratorio",
        "Nomenclatura Química",
        "Gases y Leyes de los Gases",
        "Química en la Vida Cotidiana",
        "Introducción a la Química Orgánica",
        "Carreras en Química",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon basic music theory (assume knowledge of notation, scales, basic harmony)
      - MUST cover advanced harmony: extended chords, modulation, voice leading
      - SHOULD include chapters on advanced composition techniques
      - SHOULD cover jazz theory and modern harmony
      - SHOULD introduce arranging and orchestration
      - MUST be in English
      - Should prepare for professional musician or composer roles
      - Should cover music technology and production basics

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-music-theory",
    userInput: {
      courseTitle: "Music Theory",
      locale: "en",
      previousChapters: [
        "Musical Notation",
        "Rhythm and Meter",
        "Scales and Key Signatures",
        "Intervals",
        "Triads and Seventh Chords",
        "Chord Progressions",
        "Melody Writing",
        "Basic Harmony",
        "Musical Forms",
        "Ear Training Basics",
        "Music History Overview",
        "Instrument Families",
        "Reading Sheet Music",
        "Basic Composition",
        "Careers in Music",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon basic economics (assume knowledge of supply/demand, basic macro/micro)
      - MUST cover econometrics and statistical analysis
      - SHOULD include chapters on game theory and behavioral economics
      - SHOULD cover international trade and finance
      - SHOULD introduce economic policy analysis
      - MUST be in English
      - Should prepare for economist or financial analyst roles
      - Should include data analysis tools and techniques

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-economics",
    userInput: {
      courseTitle: "Economics",
      locale: "en",
      previousChapters: [
        "Supply and Demand",
        "Elasticity",
        "Market Structures",
        "Production and Costs",
        "GDP and Economic Growth",
        "Inflation and Unemployment",
        "Monetary Policy",
        "Fiscal Policy",
        "International Economics Basics",
        "Economic Systems",
        "Personal Finance Applications",
        "Economic Indicators",
        "Market Failures",
        "Government Intervention",
        "Economics Careers",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon basic neuroscience (assume knowledge of neurons, brain structure)
      - MUST cover cognitive neuroscience and neural networks
      - SHOULD include chapters on neuropharmacology
      - SHOULD cover neurological disorders and treatments
      - SHOULD introduce research methods in neuroscience
      - MUST be in Portuguese (Brazil)
      - Should prepare for research assistant or clinical roles
      - Should cover neuroimaging techniques

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-neurociencia",
    userInput: {
      courseTitle: "Neurociência",
      locale: "pt",
      previousChapters: [
        "Estrutura do Neurônio",
        "Sistema Nervoso Central",
        "Sistema Nervoso Periférico",
        "Neurotransmissores",
        "Anatomia do Cérebro",
        "Percepção Sensorial",
        "Memória e Aprendizagem",
        "Emoções e Comportamento",
        "Desenvolvimento Neural",
        "Plasticidade Cerebral",
        "Sono e Consciência",
        "Bases da Cognição",
        "Saúde Mental",
        "Métodos de Pesquisa Básicos",
        "Carreiras em Neurociência",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon basic Spanish (assume A1/A2 level proficiency)
      - MUST cover advanced grammar: subjunctive mood, conditional, complex tenses
      - SHOULD include chapters on idiomatic expressions and regional variations
      - SHOULD cover business Spanish and professional communication
      - SHOULD introduce literature and media in Spanish
      - MUST be in English (teaching Spanish)
      - Should prepare for B2/C1 proficiency levels
      - Should cover translation and interpretation basics

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-language",
    userInput: {
      courseTitle: "Spanish Language",
      locale: "en",
      previousChapters: [
        "Spanish Alphabet and Pronunciation",
        "Basic Grammar Rules",
        "Present Tense Verbs",
        "Articles and Gender",
        "Common Vocabulary Themes",
        "Past Tenses Basics",
        "Question Formation",
        "Numbers and Time",
        "Basic Conversation",
        "Food and Dining",
        "Travel and Directions",
        "Family and Relationships",
        "Cultural Context",
        "Language Learning Strategies",
        "Spanish-Speaking Countries",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon basic cybersecurity (assume knowledge of encryption, basic threats)
      - MUST cover penetration testing and ethical hacking
      - SHOULD include chapters on incident response and forensics
      - SHOULD cover cloud security and DevSecOps
      - SHOULD introduce compliance and governance (GDPR, ISO 27001)
      - MUST be in Spanish
      - Should prepare for security analyst or consultant roles
      - Should cover security tools and frameworks

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-ciberseguridad",
    userInput: {
      courseTitle: "Ciberseguridad",
      locale: "es",
      previousChapters: [
        "Fundamentos de Ciberseguridad",
        "Criptografía Básica",
        "Autenticación y Autorización",
        "Amenazas Comunes",
        "Seguridad de Redes",
        "Seguridad de Contraseñas",
        "Malware y Antivirus",
        "Firewalls Básicos",
        "Ingeniería Social",
        "Seguridad en Aplicaciones",
        "Privacidad de Datos",
        "Copias de Seguridad",
        "Seguridad Móvil",
        "Buenas Prácticas",
        "Carreras en Ciberseguridad",
      ],
    },
  },
];
