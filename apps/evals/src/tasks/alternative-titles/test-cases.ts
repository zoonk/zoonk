const SHARED_EXPECTATIONS = `
  - Only include titles that are **equivalent** to the base title — i.e., they refer to the **same course** a user would expect to find under that subject.
  - **Same‑course test** (use all of these):
    1) Would we merge both titles into one course page? If yes, they are equivalent.
    2) Would teaching goals, syllabus scope, and prerequisites remain the same? If yes, they are equivalent.
    3) Is the difference only wording, dialect/variant, audience, abbreviation, or light framing? If yes, they are equivalent.
  - **Broader/narrower rule**:
    - **Broader** expands scope beyond the subject’s core boundaries → exclude. Example: "Web Development" is broader than "Frontend Development".
    - **Narrower** is a proper subset that we’d plausibly ship as a separate course (different scope/learning goals) → exclude. Example: "React" is narrower than "JavaScript"; "Deep Learning" is narrower than "Machine Learning".
  - **Not narrower (allowed)** when it is still the same course subject:
    - **Dialect/variant** names (e.g., "Inglês Americano", "Inglês Britânico", "French Grammar", "Optimisation" vs "Optimization"). Dialects are surface variants of the same language course.
    - **Audience qualifiers** (e.g., "IA para Desenvolvedores", "UX for Healthcare"). Audience framing ≠ topic narrowing if the core subject stays the same.
    - **Series/labeling of the same entity** (e.g., "Formula One", "F1", "Formula One Championship", "F1 Series") — these all clearly denote the same sport/competition brand.
    - **Light framing words** like "principles", "fundamentals", "basics", "overview", or "for beginners" when the core topic remains unchanged.
  - **Decision checklist for each candidate title** (answer all):
    - Does it introduce a different subfield or tool? If yes → narrower → exclude.
    - Does it expand to an umbrella domain? If yes → broader → exclude.
    - If we offered both titles simultaneously, would users be confused by two separate courses? If yes → they are equivalent and, therefore, can be included as an alternative title.
  - **Concrete examples**:
    - **Include**: "Client‑Side Web Development" ↔ "Frontend Development"; "IA" / "Inteligência Artificial" / "IA para Desenvolvedores"; "Inglês" ↔ "Inglês Americano" / "Inglês Britânico" / "Inglês Britânico e Americano"; "Formula 1" ↔ "Formula One" / "F1" / "Formula One Championship" / "F1 Series"; "UX Design" ↔ "UX Design Principles"; "World War II" ↔ "WWII" / "Second World War"; "Data Science" ↔ "Data Science Fundamentals".
    - **Exclude**: "Web Development" (broader than "Frontend Development"); "Aprendizado de Máquina" (narrower than "Inteligência Artificial"); "React" (narrower than "JavaScript"); "Deep Learning" (narrower than "Machine Learning"); "Motorsport" (broader than "Formula 1"); "Differential Calculus" (narrower than "Calculus").
  - Include different locale spellings when applicable (e.g., "Optimization" and "Optimisation").
  - Include abbreviations if they mean the same thing (e.g., "AI"/"IA", "ML" when base is "Machine Learning").
  - Levels like "Beginner", "Advanced", "Calculus 1", "101", etc., are acceptable if they keep the same subject.
  - It’s fine to skip spacing/hyphenation/accents variants — serialization will handle those.
  - Awkward or redundant phrasings are acceptable.
  - Ignore casing issues (e.g., "javascript" vs "JavaScript").
`;

export const TEST_CASES = [
  {
    expectations: `
      - Should include "Frontend Engineering"
      - Should NOT include topics like "Web Development" and "JavaScript Development" since those are separate courses
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-frontend-development",
    userInput: {
      language: "en",
      title: "Frontend Development",
    },
  },
  {
    expectations: `
      - Should include items like "Formula One", "F1"
      - Should NOT include "Motorsport", "Racing", etc.
      - Items like "F1 Racing", "Formula One Championship", "F1 Series", etc. are fine because they clearly refer to Formula 1
      - A narrower topic in this context would be something like "F1 Engineering" because it focuses is on engineering aspects
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-formula-1",
    userInput: {
      language: "en",
      title: "Formula 1",
    },
  },
  {
    expectations: `
      - Should include "User Experience Design"
      - Should NOT include "UI Design", "Web Design", etc
      - Items such as "UX Design Principles" are fine since they have the same meaning: a UX course
      - Similarly, anything that uses "UX for X" is also acceptable since it involves the same UX course
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ux-design",
    userInput: {
      language: "en",
      title: "UX Design",
    },
  },
  {
    expectations: `
      - Should include "Língua Inglesa", "A Língua Inglesa"
      - Variants like "Inglês Americano", "Inglês Britânico" are acceptable since they refer to the same language
      - Terms like "Inglês Moderno" and "Inglês Contemporâneo" are acceptable since they refer to the same language
      - Anything that refers to learning English is acceptable
      - Should NOT include "Cultura Inglesa", "Gramática Inglesa", "Spanish", etc
      - Should NOT include exams like "TOEFL", "IELTS", etc., since they are different topics
      - Should be in Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles",
    userInput: {
      language: "pt",
      title: "Inglês",
    },
  },
  {
    expectations: `
      - Should include "IA"
      - Should NOT include "Aprendizado de Máquina", "Inteligência Humana", etc
      - Items like "IA para X" are also acceptable since they refer to the same core subject.
      - All alternatives should be in Brazilian Portuguese
      - Should be in Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-inteligencia-artificial",
    userInput: {
      language: "pt",
      title: "Inteligência Artificial",
    },
  },
  {
    expectations: `
      - Should include "ML"
      - Should NOT include "AI", "Deep Learning", etc
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-machine-learning",
    userInput: {
      language: "en",
      title: "Machine Learning",
    },
  },
  {
    expectations: `
      - Should include "JS", "JavaScript Programming", "JavaScript Language", etc
      - Should NOT include "Web Development", "React" since they're different courses
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript",
    userInput: {
      language: "en",
      title: "JavaScript",
    },
  },
  {
    expectations: `
      - Should include "Python Programming", "Python Language", "Python for Beginners"
      - Should NOT include "Programming", "Data Science", etc
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-python",
    userInput: {
      language: "en",
      title: "Python",
    },
  },
  {
    expectations: `
      - Should include "Desarrollo de Sitios Web", "Programación Web", etc
      - All alternatives should be in Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-desarrollo-web",
    userInput: {
      language: "es",
      title: "Desarrollo Web",
    },
  },
  {
    expectations: `
      - Should NOT include "Machine Learning", "Statistics", "Big Data", etc
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-data-science",
    userInput: {
      language: "en",
      title: "Data Science",
    },
  },
  {
    expectations: `
      - Should include "Matrix Movie" (without "The")
      - May include "The Matrix Trilogy" and similar variations since it refers to the same film series
      - Should NOT include just "Matrix" (ambiguous)
      - Should NOT include broader courses like "Science Fiction Films"
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-the-matrix",
    userInput: {
      language: "en",
      title: "The Matrix",
    },
  },
  {
    expectations: `
      - Should NOT include "Mathematics", "Differential Calculus", etc
      - Levels like Calculus I, II, III are acceptable since they refer to the same subject
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-calculus",
    userInput: {
      language: "en",
      title: "Calculus",
    },
  },
  {
    expectations: `
      - Should include "World War 2", "Second World War", "WWII", "WW2"
      - Should NOT include just "World War" or "World War I"
      - Results should be in English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-world-war-2",
    userInput: {
      language: "en",
      title: "World War II",
    },
  },
];
