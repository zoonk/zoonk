const SHARED_EXPECTATIONS = `
  - Chapters should be 3-7 words long
  - Should cover specialized topics and advanced techniques
  - Should prepare learners to lead projects and mentor others
  - Should prepare for certifications, master's degree, or PhD level study
  - Should position learners at the top of their field
  - Should NOT include personalized content like "Build Your Own X", "Final Project"
  - Should NOT repeat chapters from basic or intermediate levels
  - Should use modern terminology and current best practices
  - Should be split into granular topics
  - Should follow the language specified by locale parameter
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST build upon intermediate Python (assume advanced OOP, frameworks, testing knowledge)
      - MUST cover specialized topics: metaprogramming, async programming at scale, CPython internals
      - SHOULD include chapters on performance profiling, optimization techniques
      - SHOULD cover distributed systems with Python
      - SHOULD introduce contributing to open source and Python core
      - MUST be in English
      - Should prepare for principal engineer or architect roles
      - Should cover topics relevant for Python core contributors
      - Should have 10-15 highly specialized chapters

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
        "Advanced OOP",
        "Decorators and Metaclasses",
        "Generators and Iterators",
        "Context Managers",
        "Testing and TDD",
        "Django Framework",
        "Async Programming",
        "Performance Optimization",
        "Design Patterns",
        "Database Integration",
        "RESTful APIs",
        "Package Development",
        "CI/CD for Python",
        "Security Best Practices",
        "Code Review and Quality",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon intermediate web dev (assume framework mastery, build tools, optimization)
      - MUST cover advanced architecture: micro-frontends, progressive web apps
      - SHOULD include chapters on advanced performance optimization, Core Web Vitals
      - SHOULD cover WebAssembly and cutting-edge web technologies
      - SHOULD introduce large-scale application architecture
      - MUST be in Portuguese (Brazil)
      - Should prepare for staff engineer or technical lead roles
      - Should cover topics for conference speakers and thought leaders
      - Should include accessibility at expert level (WCAG 2.2, ARIA patterns)

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
        "React Avançado",
        "State Management",
        "Build Tools e Bundlers",
        "TypeScript",
        "Testing em Frontend",
        "Performance Web",
        "SEO Técnico",
        "APIs Modernas do Navegador",
        "Progressive Web Apps",
        "Server-Side Rendering",
        "GraphQL",
        "Web Security",
        "Padrões de Design Frontend",
        "CI/CD para Web",
        "Monitoring e Analytics",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon intermediate chemistry (assume organic chemistry, analytical techniques)
      - MUST cover advanced topics: computational chemistry, spectroscopy mastery
      - SHOULD include chapters on chemical synthesis design
      - SHOULD cover research methodology and publication
      - SHOULD introduce cutting-edge areas (green chemistry, materials science)
      - MUST be in Spanish
      - Should prepare for PhD programs or senior research roles
      - Should cover topics for leading research teams
      - Should include industry applications at expert level

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
        "Química Orgánica Avanzada",
        "Cinética Química",
        "Equilibrio Químico",
        "Termodinámica Química",
        "Electroquímica",
        "Espectroscopía",
        "Química Analítica Instrumental",
        "Química Inorgánica",
        "Química de Polímeros",
        "Métodos de Investigación",
        "Síntesis Química",
        "Química Computacional Básica",
        "Control de Calidad",
        "Química Industrial",
        "Gestión de Laboratorio",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon intermediate music theory (assume advanced harmony, composition, orchestration)
      - MUST cover specialized topics: modal harmony, serialism, contemporary techniques
      - SHOULD include chapters on music analysis at PhD level
      - SHOULD cover ethnomusicology and world music theory systems
      - SHOULD introduce music research and scholarship
      - MUST be in English
      - Should prepare for composer, professor, or musicologist roles
      - Should cover topics for leading ensembles and publishing research
      - Should include advanced music technology and electronic composition

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
        "Advanced Harmony",
        "Voice Leading",
        "Modulation Techniques",
        "Jazz Theory",
        "Extended Chords",
        "Orchestration",
        "Contemporary Composition",
        "Music Arrangement",
        "Counterpoint",
        "Advanced Ear Training",
        "Film Scoring Basics",
        "Music Production",
        "Advanced Analysis",
        "World Music Theory",
        "Music Technology",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon intermediate economics (assume econometrics, game theory, policy analysis)
      - MUST cover specialized topics: advanced macro models, experimental economics
      - SHOULD include chapters on economic forecasting and modeling
      - SHOULD cover cutting-edge research areas (behavioral, environmental, digital economics)
      - SHOULD introduce economic research methodology and publication
      - MUST be in English
      - Should prepare for PhD programs, chief economist, or policy advisor roles
      - Should cover topics for leading economic research
      - Should include advanced quantitative methods

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
        "Econometrics",
        "Game Theory",
        "Behavioral Economics",
        "International Trade",
        "Exchange Rates",
        "Development Economics",
        "Environmental Economics",
        "Labor Economics",
        "Public Economics",
        "Financial Markets",
        "Economic Policy Analysis",
        "Time Series Analysis",
        "Panel Data Methods",
        "Causal Inference",
        "Research Design",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon intermediate neuroscience (assume cognitive neuro, research methods, neuroimaging)
      - MUST cover specialized topics: computational neuroscience, neural engineering
      - SHOULD include chapters on advanced neuroimaging analysis
      - SHOULD cover cutting-edge research (optogenetics, brain-computer interfaces)
      - SHOULD introduce clinical trials and translational research
      - MUST be in Portuguese (Brazil)
      - Should prepare for PhD programs or principal investigator roles
      - Should cover topics for leading neuroscience research teams
      - Should include grant writing and research leadership

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
        "Neurociência Cognitiva",
        "Redes Neurais",
        "Neurofarmacologia",
        "Distúrbios Neurológicos",
        "Neuroimagem",
        "Eletrofisiologia",
        "Neurociência Molecular",
        "Neurociência Comportamental",
        "Neurociência do Desenvolvimento",
        "Neurociência Clínica",
        "Métodos de Pesquisa Avançados",
        "Análise de Dados Neurocientíficos",
        "Modelos Animais",
        "Neuroterapêutica",
        "Ética em Pesquisa Neurocientífica",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon intermediate Spanish (assume B2/C1 level, business Spanish, translation)
      - MUST cover specialized topics: literary analysis, dialectology, historical linguistics
      - SHOULD include chapters on simultaneous interpretation
      - SHOULD cover teaching Spanish as a foreign language at expert level
      - SHOULD introduce Spanish linguistics research
      - MUST be in English (teaching Spanish)
      - Should prepare for C2 proficiency, translator certification, or linguistics PhD
      - Should cover topics for conference interpreters and language researchers
      - Should include specialized domains (legal, medical, technical Spanish)

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
        "Subjunctive Mood",
        "Advanced Grammar",
        "Idiomatic Expressions",
        "Business Spanish",
        "Regional Variations",
        "Spanish Literature",
        "Media in Spanish",
        "Translation Basics",
        "Professional Communication",
        "Academic Spanish",
        "Advanced Conversation",
        "Spanish Cinema",
        "Interpretation Skills",
        "Spanish for Specific Purposes",
        "Language Teaching Methods",
      ],
    },
  },
  {
    expectations: `
      - MUST build upon intermediate cybersecurity (assume pen testing, incident response, compliance)
      - MUST cover specialized topics: threat intelligence, advanced persistent threats
      - SHOULD include chapters on security architecture for enterprises
      - SHOULD cover cutting-edge topics (AI in security, quantum cryptography)
      - SHOULD introduce security research and vulnerability discovery
      - MUST be in Spanish
      - Should prepare for CISO roles, security researcher, or red team lead
      - Should cover topics for leading security organizations
      - Should include security certifications like OSCP, CISSP prep

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
        "Penetration Testing",
        "Ethical Hacking",
        "Respuesta a Incidentes",
        "Análisis Forense Digital",
        "Seguridad en la Nube",
        "DevSecOps",
        "Cumplimiento Normativo",
        "Gestión de Vulnerabilidades",
        "Seguridad en Contenedores",
        "Análisis de Malware",
        "Threat Hunting",
        "Red Team Operations",
        "Security Operations Center",
        "Gestión de Riesgos",
        "Auditorías de Seguridad",
      ],
    },
  },
];
