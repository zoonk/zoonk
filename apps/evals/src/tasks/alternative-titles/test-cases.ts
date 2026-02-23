const SHARED_EXPECTATIONS = `
  **PURPOSE**: Alternative titles prevent AI from generating duplicate courses for the same subject. If someone creates "Python for Data Science", the AI should recognize it as the existing "Python" course — not create a separate one. The list catches all title variants that map to the same course.

  **CORE RULE**: If the title still contains the base subject (or a recognized synonym/abbreviation), it is the SAME course — regardless of qualifiers, subtitles, tools, focus areas, or context added to it. We do NOT want separate courses for each variant.

  Examples of this rule:
  - "World War II: Normandy and D-Day" → contains "World War II" → same course
  - "Python for Data Science" → contains "Python" → same course
  - "IA Generativa" → contains "IA" → same course
  - "Desarrollo Web con React" → contains "Desarrollo Web" → same course
  - "ML with Python" → contains "ML" → same course
  - "Differential Calculus" → contains "Calculus" → same course
  - "Formula 1 Motorsport" → contains "Formula 1" → same course

  **When to EXCLUDE**:
  - **Broader**: The title covers a larger domain that encompasses unrelated subjects → exclude. Example: "Web Development" is broader than "Frontend Development"; "Programming" is broader than "Python"; standalone "Motorsport" is broader than "Formula 1".
  - **Standalone different subject**: The title drops the base subject entirely and represents something else → exclude. Example: "React" (no "JavaScript" in the title — it’s its own technology); "Deep Learning" (no "Machine Learning" — it’s its own field); "Battle of Normandy" (no "World War II" — it’s its own topic); standalone "Motorsport" (no "Formula 1").
  - **Ambiguous**: The title could refer to multiple unrelated topics → exclude. Example: just "Matrix" without any disambiguator.

  **Also include** (even without the base subject in the title):
  - **Recognized synonyms/abbreviations**: "WWII" / "Second World War" ↔ "World War II"; "F1" ↔ "Formula 1"; "ML" ↔ "Machine Learning"; "JS" ↔ "JavaScript"; "UI Development" / "Client-Side Development" ↔ "Frontend Development".
  - **Dialect/variant names**: "Inglês Americano", "Inglês Britânico", "Optimisation" vs "Optimization".
  - **Language learning aspects**: "Gramática Inglesa", "TOEFL", "Business English" — all map to the same language course.
  - **Light framing words**: "principles", "fundamentals", "basics", "bootcamp", "certification prep" — these don’t change the subject.
  - **Descriptive disambiguators**: "The Matrix (1999 film)", "Matrix Movie" — these clarify which subject, they don’t change it.

  Additional notes:
  - Include different locale spellings when applicable (e.g., "Optimization" and "Optimisation").
  - Include abbreviations if they mean the same thing (e.g., "AI"/"IA", "ML" when base is "Machine Learning").
  - Levels like "Beginner", "Advanced", "Calculus 1", "101", etc., are acceptable.
  - It’s fine to skip spacing/hyphenation/accents variants — serialization will handle those.
  - Awkward or redundant phrasings are acceptable.
  - Ignore casing issues (e.g., "javascript" vs "JavaScript").
  - Well-known English terms in non-English titles are acceptable (e.g., "Business English" in Portuguese, "TOEFL", "IELTS").
  - Ideally, it should have a huge list of alternative titles, really good ones have more than 100 alternative titles

  SCORING CALIBRATION:
  - Apply the CORE RULE above as the PRIMARY lens: does the title still contain the base subject? If yes → it’s the same course, do NOT penalize.
  - Only penalize for titles that are genuinely broader (umbrella domain), a standalone different subject (base subject dropped entirely), or ambiguous.
  - Do NOT penalize for qualifiers, subtitles, tools, focus areas, or context added to the base subject — these are all the same course.
  - Do NOT heavily penalize for missing titles — only penalize for wrong inclusion/exclusion decisions.
  - A large list is ideal but do NOT heavily penalize shorter lists if all included titles are correct.
`;

export const TEST_CASES = [
  {
    expectations: `
      - Should include "Frontend Engineering", "Client-Side Development"
      - "UI Development" and similar titles are acceptable — they refer to the same discipline
      - Should NOT include "Web Development" (broader) or "JavaScript" (different subject)
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
      - Items like "F1 Racing", "Formula One Championship", "F1 Series", "Formula 1 Motorsport" are fine because they clearly refer to Formula 1
      - Should NOT include standalone "Motorsport" or "Racing" (broader subjects that encompass more than F1)
      - A genuinely different subject would be something like "F1 Engineering" or "Motorsport Engineering"
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
      - Should include any title that a user might search for when wanting to learn English, since our platform consolidates all English learning into one course
      - This INCLUDES: "Gramática Inglesa", "Vocabulário de Inglês", "Pronúncia do Inglês", "Conversação em Inglês", "TOEFL", "IELTS", "Cambridge English" — these all map to the same English course
      - Professional/purpose context is also acceptable: "Inglês Técnico", "Inglês para Negócios", "Business English", "Inglês para Entrevistas", "Inglês Acadêmico" — these are all English learning, not separate subjects
      - Well-known English terms are acceptable even in Portuguese titles (e.g., "Business English", "TOEFL", "IELTS")
      - Should NOT include: "Cultura Inglesa" (culture, not language learning), "Literatura Inglesa" (literature, not language learning), "Spanish" (different language)
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
      - Variants like "IA Generativa", "IA com ChatGPT", "IA com LLMs" are acceptable — they still contain "IA", so they're the same course
      - Items like "IA para X" are also acceptable since they refer to the same core subject
      - Should NOT include standalone different subjects like "Aprendizado de Máquina", "Deep Learning", "ChatGPT" — these drop "IA" entirely
      - Should NOT include "Inteligência Humana" (different subject)
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
      - "ML with X" variants (e.g., "ML with Python", "ML with TensorFlow", "ML with scikit-learn") are acceptable — the core subject is still Machine Learning
      - Should NOT include "AI", "Deep Learning", "Data Science" — these are genuinely different fields
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
      - "Python for X" variants (e.g., "Python for Data Science", "Python for Web Development", "Python for Automation") are acceptable — these are all Python courses, not separate subjects
      - Should NOT include standalone different subjects like "Data Science", "Web Development", "Programming" — these are broader/different courses
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
      - "Full Stack" variants like "Desarrollo Web Full Stack" are acceptable — it's still web development
      - "Diseño y Desarrollo Web" is acceptable — design framing doesn't make it a different course
      - Tool/framework variants like "Desarrollo Web con React", "Desarrollo Web con Angular", "Desarrollo Web con Django" are acceptable — they still contain "Desarrollo Web", so they're the same course
      - Should NOT include standalone "Programación" (broader) or standalone "Frontend" / "Backend" / "React" / "Angular" (different subjects — they drop "Desarrollo Web" entirely)
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
      - Variants like "Data Science Certification Prep", "Data Science Bootcamp" are acceptable — they're still data science
      - Should NOT include "Machine Learning", "Statistics", "Big Data" as standalone subjects — these are genuinely different fields
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
      - Descriptive disambiguators are acceptable: "The Matrix (1999 film)", "Matrix (1999 film)", "The Matrix (Keanu Reeves film)", "The Matrix (bullet time film)" — these clarify which subject, they don't change it. "Matrix (1999 film)" is NOT ambiguous because the disambiguator makes the subject clear
      - Should NOT include just "Matrix" alone without any disambiguator (ambiguous — could refer to mathematics, the movie, etc.)
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
      - Sub-areas like "Differential Calculus", "Integral Calculus", "Limits and Continuity" are acceptable — we wouldn't want separate courses for these, they're all calculus
      - Levels like Calculus I, II, III are acceptable since they refer to the same subject
      - Should NOT include "Mathematics" (broader) or "Linear Algebra" (different subject)
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
      - Subtitled variants like "World War II: Normandy and D-Day", "World War II: Holocaust and Genocide", "European Theater of World War II" are acceptable — they still contain "World War II", so they're the same course
      - Should NOT include standalone topics that drop "World War II" entirely, like "Battle of Normandy", "D-Day", "Holocaust" — those could be their own courses
      - Should NOT include just "World War" (broader) or "World War I" (different subject)
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
