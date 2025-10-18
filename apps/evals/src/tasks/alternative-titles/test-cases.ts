const SHARED_EXPECTATIONS = `
  - Should only include titles with the same meaning as the base title
  - It's fine to include slight variations if they intent/meaning is the same.
    For example, "F1 Racing" is acceptable because it clearly refers to "Formula 1", not the broader "Racing" topic;
    "Client Side Web Development" is acceptable as it clearly refers to "Frontend Development";
    "UX Design Principles" is acceptable as it clearly refers to "UX Design", it's not a narrower topic.
    Try to capture the meaning/intent rather than just exact wording
  - Should NOT include broader or narrower topics
  - Should include different locale spellings when applicable (e.g., "Optimization" and "Optimisation")
  - Should include abbreviations if they mean the same thing
  - It's fine to include levels like "Beginner", "Advanced", "Calculus 1", "101" etc., if they refer to the same subject
  - It's fine if it doesn't include variants with spacing, hyphenation, or accents since those will be serialized
  - Don't worry about awkward or redundant phrasings, that's acceptable
  - Don't worry about casing issues (e.g., "javascript" vs "JavaScript")
`;

export const TEST_CASES = [
  {
    id: "en-frontend-development",
    userInput: {
      title: "Frontend Development",
    },
    expectations: `
      - Should include "Frontend Engineering"
      - Should NOT include topics like "Web Development" and "JavaScript Development" since those are separate courses
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-formula-1",
    userInput: {
      title: "Formula 1",
    },
    expectations: `
      - Should include items like "Formula One", "F1"
      - Should NOT include "Motorsport", "Racing", etc.
      - "F1 Racing" is fine because it clearly refers to Formula 1
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-ux-design",
    userInput: {
      title: "UX Design",
    },
    expectations: `
      - Should include "User Experience Design"
      - Should NOT include "UI Design", "Web Design", etc
      - Items such as "UX Design Principles" are fine since they have the same meaning: a UX course
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-ingles",
    userInput: {
      title: "Inglês",
    },
    expectations: `
      - Should include "Língua Inglesa", "A Língua Inglesa"
      - Should NOT include "Cultura Inglesa", "Gramática Inglesa", "Spanish", etc
      - Should be in Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-inteligencia-artificial",
    userInput: {
      title: "Inteligência Artificial",
    },
    expectations: `
      - Should include "IA"
      - Should NOT include "Aprendizado de Máquina", "Inteligência Humana", etc
      - All alternatives should be in Brazilian Portuguese
      - Should be in Portuguese

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-machine-learning",
    userInput: {
      title: "Machine Learning",
    },
    expectations: `
      - Should include "ML"
      - Should NOT include "AI", "Deep Learning", etc
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-javascript",
    userInput: {
      title: "JavaScript",
    },
    expectations: `
      - Should include "JS", "JavaScript Programming", "JavaScript Language", etc
      - Should NOT include "Web Development", "React" since they're different courses
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-python",
    userInput: {
      title: "Python",
    },
    expectations: `
      - Should include "Python Programming", "Python Language", "Python for Beginners"
      - Should NOT include "Programming", "Data Science", etc
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "es-desarrollo-web",
    userInput: {
      title: "Desarrollo Web",
    },
    expectations: `
      - Should include "Desarrollo de Sitios Web", "Programación Web", etc
      - All alternatives should be in Spanish

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-data-science",
    userInput: {
      title: "Data Science",
    },
    expectations: `
      - Should NOT include "Machine Learning", "Statistics", "Big Data", etc
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-the-matrix",
    userInput: {
      title: "The Matrix",
    },
    expectations: `
      - Should include "Matrix Movie" (without "The")
      - May include "The Matrix Trilogy" and similar variations since it refers to the same film series
      - Should NOT include just "Matrix" (ambiguous)
      - Should NOT include broader courses like "Science Fiction Films"
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-calculus",
    userInput: {
      title: "Calculus",
    },
    expectations: `
      - Should NOT include "Mathematics", "Differential Calculus", etc
      - Levels like Calculus I, II, III are acceptable since they refer to the same subject
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-world-war-2",
    userInput: {
      title: "World War II",
    },
    expectations: `
      - Should include "World War 2", "Second World War", "WWII", "WW2"
      - Should NOT include just "World War" or "World War I"
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
  },
];
