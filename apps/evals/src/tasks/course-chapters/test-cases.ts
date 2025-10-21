import { PT_AGILE_BASIC, PT_AGILE_INTERMEDIATE } from "./chapters";

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
];
