import {
  EN_BIOLOGY_BASIC,
  EN_BIOLOGY_INTERMEDIATE,
  EN_FRONTEND_BASIC,
  EN_FRONTEND_INTERMEDIATE,
  EN_QUANTUM_PHYSICS_BASIC,
  EN_QUANTUM_PHYSICS_INTERMEDIATE,
  PT_AGILE_BASIC,
  PT_AGILE_INTERMEDIATE,
  PT_LAW_BASIC,
  PT_LAW_INTERMEDIATE,
} from "./chapters";

const SHARED_EXPECTATIONS = `
  - Extensive list of chapters
  - Progressive learning path, build upon previous chapters
  - Modern terminology
  - Avoid covering too much in a single chapter
  - Current, relevant to current trends
  - Never use things like "Final Project", "Course Conclusion" or anything that implies interaction with students (1-on-1, assignments, etc.)
  - Should not include previous chapters in the output, just the new ones
`;

const BASIC_LEVEL_EXPECTATIONS = `
  - Should be suitable for beginners with no prior knowledge
  - Allow them to get an entry-level job in the field
  - Prepare them for real-world scenarios and challenges
`;

const INTERMEDIATE_LEVEL_EXPECTATIONS = `
  - Should build upon previous chapters
  - Allow them to tackle complex tasks and projects
  - Prepare them for senior job roles in the field
`;

const ADVANCED_LEVEL_EXPECTATIONS = `
  - Build upon previous chapters
  - Cover specialized topics and advanced techniques
  - Allow them to lead complex projects and mentor others
  - Prepare them for certifications or advanced studies in the subject
  - Prepare them to be at the forefront of the field
`;

export const TEST_CASES = [
  {
    id: "pt-metodologias-ageis-basic",
    userInput: {
      courseTitle: "Metodologias Ágeis",
      locale: "pt",
      level: "basic",
      previousChapters: [],
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Teach the Agile mindset, core principles, and terminology
      - How to apply Agile methodologies in real-world projects
      - Prepare students for working in Agile teams
      - Be up-to-date with the latest Agile practices and tools
      - Avoid overly technical jargon

      ${SHARED_EXPECTATIONS}
      ${BASIC_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "pt-metodologias-ageis-intermediate",
    userInput: {
      courseTitle: "Metodologias Ágeis",
      locale: "pt",
      level: "intermediate",
      previousChapters: PT_AGILE_BASIC,
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Deepen understanding of Agile frameworks
      - How to lead Agile teams and manage Agile projects
      - Prepare students for senior roles in Agile environments
      - Include case studies and real-world applications of Agile methodologies

      ${SHARED_EXPECTATIONS}
      ${INTERMEDIATE_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "pt-metodologias-ageis-advanced",
    userInput: {
      courseTitle: "Metodologias Ágeis",
      locale: "pt",
      level: "advanced",
      previousChapters: [...PT_AGILE_BASIC, ...PT_AGILE_INTERMEDIATE],
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Explore advanced Agile concepts and techniques
      - How to implement Agile at an organizational level
      - Prepare students for leadership roles in Agile transformations
      - Discuss emerging trends and future directions in Agile methodologies

      ${SHARED_EXPECTATIONS}
      ${ADVANCED_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-frontend-development-basic",
    userInput: {
      courseTitle: "Frontend Development",
      locale: "en",
      level: "basic",
      previousChapters: [],
    },
    expectations: `
      - Content in English
      - Teach the fundamentals of frontend development
      - Cover HTML, CSS, and JavaScript basics
      - Cover frontend frameworks
      - Prepare students for entry-level frontend developer roles

      ${SHARED_EXPECTATIONS}
      ${BASIC_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-frontend-development-intermediate",
    userInput: {
      courseTitle: "Frontend Development",
      locale: "en",
      level: "intermediate",
      previousChapters: EN_FRONTEND_BASIC,
    },
    expectations: `
      - Content in English
      - Deepen understanding of frontend development concepts
      - Cover advanced JavaScript, frontend frameworks, and performance optimization
      - Prepare for senior frontend developer roles

      ${SHARED_EXPECTATIONS}
      ${INTERMEDIATE_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-frontend-development-advanced",
    userInput: {
      courseTitle: "Frontend Development",
      locale: "en",
      level: "advanced",
      previousChapters: [...EN_FRONTEND_BASIC, ...EN_FRONTEND_INTERMEDIATE],
    },
    expectations: `
      - Content in English
      - Explore advanced frontend development topics
      - Cover topics like architecture, scalability, and cutting-edge technologies
      - Prepare for leadership roles in frontend development
      - Prepare to be at the forefront of frontend development
      - At the end of this course, they should be able to take roles at top tech companies

      ${SHARED_EXPECTATIONS}
      ${ADVANCED_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-biology-basic",
    userInput: {
      courseTitle: "Biology",
      locale: "en",
      level: "basic",
      previousChapters: [],
    },
    expectations: `
      - Content in English
      - Should cover fundamental biology topics such as cell structure, genetics, evolution, and ecology
      - Prepare students for further studies in biology or related fields

      ${SHARED_EXPECTATIONS}
      ${BASIC_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-biology-intermediate",
    userInput: {
      courseTitle: "Biology",
      locale: "en",
      level: "intermediate",
      previousChapters: EN_BIOLOGY_BASIC,
    },
    expectations: `
      - Content in English
      - Cover more complex topics such as molecular biology, physiology, and biodiversity
      - Prepare students for advanced studies, research or a career in biology

      ${SHARED_EXPECTATIONS}
      ${INTERMEDIATE_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-biology-advanced",
    userInput: {
      courseTitle: "Biology",
      locale: "en",
      level: "advanced",
      previousChapters: [...EN_BIOLOGY_BASIC, ...EN_BIOLOGY_INTERMEDIATE],
    },
    expectations: `
      - Content in English
      - Explore advanced biology topics such as genomics, biotechnology, and ecological conservation
      - Prepare students for leadership roles in biological research or industry
      - Prepare them to be at the forefront of biological sciences
      - At the end of this course, they should be able to take roles at top research institutions or biotech companies
      - They should be ready to do a Master's or PhD in Biology or related fields

      ${SHARED_EXPECTATIONS}
      ${ADVANCED_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "pt-law-basic",
    userInput: {
      courseTitle: "Direito",
      locale: "pt",
      level: "basic",
      previousChapters: [],
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Should cover fundamental law topics such as constitutional law, civil law, criminal law, and administrative law
      - Prepare students for further studies in law or related fields

      ${SHARED_EXPECTATIONS}
      ${BASIC_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "pt-law-intermediate",
    userInput: {
      courseTitle: "Direito",
      locale: "pt",
      level: "intermediate",
      previousChapters: PT_LAW_BASIC,
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Cover more complex topics such as international law, labor law, and environmental law
      - Prepare students for advanced studies, research or a career in law
      - They should be able to get enough knowledge to get a job at a law firm

      ${SHARED_EXPECTATIONS}
      ${INTERMEDIATE_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "pt-law-advanced",
    userInput: {
      courseTitle: "Direito",
      locale: "pt",
      level: "advanced",
      previousChapters: [...PT_LAW_BASIC, ...PT_LAW_INTERMEDIATE],
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Explore advanced law topics such as corporate law, intellectual property, and human rights law
      - Prepare students for leadership roles in legal practice or academia
      - Prepare them to be at the forefront of legal developments
      - At the end of this course, they should be able to take roles at top law firms or pursue advanced degrees in law
      - They should be ready to pass the OAB (Brazilian Bar Examination)

      ${SHARED_EXPECTATIONS}
      ${ADVANCED_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-quantum-physics-basic",
    userInput: {
      courseTitle: "Quantum Physics",
      locale: "en",
      level: "basic",
      previousChapters: [],
    },
    expectations: `
      - Content in English
      - Should cover fundamental quantum physics topics such as wave-particle duality, quantum mechanics principles, and applications
      - Prepare students for further studies in physics or related fields

      ${SHARED_EXPECTATIONS}
      ${BASIC_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-quantum-physics-intermediate",
    userInput: {
      courseTitle: "Quantum Physics",
      locale: "en",
      level: "intermediate",
      previousChapters: EN_QUANTUM_PHYSICS_BASIC,
    },
    expectations: `
      - Content in English
      - Cover more complex topics such as quantum field theory, quantum computing, and advanced applications
      - Prepare students for advanced studies, research or a career in physics
      - They should be able to get enough knowledge to get a job as a research assistant, a lab technician or at a startup

      ${SHARED_EXPECTATIONS}
      ${INTERMEDIATE_LEVEL_EXPECTATIONS}
    `,
  },
  {
    id: "en-quantum-physics-advanced",
    userInput: {
      courseTitle: "Quantum Physics",
      locale: "en",
      level: "advanced",
      previousChapters: [
        ...EN_QUANTUM_PHYSICS_BASIC,
        ...EN_QUANTUM_PHYSICS_INTERMEDIATE,
      ],
    },
    expectations: `
      - Content in English
      - Explore advanced quantum physics topics such as quantum entanglement, quantum cryptography, and cutting-edge research
      - Prepare students for leadership roles in physics research or industry
      - Prepare them to be at the forefront of quantum physics
      - At the end of this course, they should be able to take roles at top research institutions or tech companies working on quantum technologies
      - They should be ready to do a Master's or PhD in Quantum Physics or related fields

      ${SHARED_EXPECTATIONS}
      ${ADVANCED_LEVEL_EXPECTATIONS}
    `,
  },
];
