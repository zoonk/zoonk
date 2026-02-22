const SHARED_EXPECTATIONS = `
  **PURPOSE**: Alternative titles prevent AI from generating duplicate courses for the same subject. If someone creates "Python for Data Science", the AI should recognize it as the existing "Python" course — not create a separate one. The list catches all title variants that map to the same course.

  - **Duplicate‑prevention test** (the PRIMARY evaluation lens): If an AI generated a course with this alternative title, would we want it as a SEPARATE course on our platform, or is it a duplicate of the base course? If duplicate → include.
  - **Broader rule**: A title that covers a larger domain than the base subject → exclude. Example: "Web Development" is broader than "Frontend Development"; "Programming" is broader than "Python"; standalone "Motorsport" is broader than "Formula 1".
  - **Narrower rule**: Only exclude titles that represent a genuinely different technology, framework, or established field with its own independent identity. Example: "React" is a different technology from "JavaScript"; "Deep Learning" is a distinct specialized field from "Machine Learning". The key test: does this title represent something with its own ecosystem, tooling, and community that people specifically seek out? If yes → different subject → exclude.
  - **Not a different subject (include)** — all of these map to the same course:
    - **Application context**: "Python for Data Science", "Python for Web Development", "ML with Python", "Calculus for Engineers" — the base subject is the same, just applied to a context. We do NOT want separate courses for each "X for Y" variant.
    - **Sub-areas of the same subject**: "Differential Calculus" / "Integral Calculus" under "Calculus" — these are parts of the same course, not separate subjects.
    - **Tool/language framing**: "ML with Python", "ML with TensorFlow" — the focus is still ML, the tool is just context.
    - **Category descriptors**: "Formula 1 Motorsport", "Python Programming Language" — adding a category word to the base title doesn’t change the subject.
    - **Dialect/variant** names (e.g., "Inglês Americano", "Inglês Britânico", "Optimisation" vs "Optimization").
    - **Audience qualifiers** (e.g., "IA para Desenvolvedores", "UX for Healthcare").
    - **Series/labeling** (e.g., "Formula One", "F1", "Formula One Championship", "F1 Racing").
    - **Light framing words** like "principles", "fundamentals", "basics", "overview", "for beginners", "certification prep", "bootcamp".
    - **Professional/purpose context** for language courses: "Business English", "Inglês Técnico", "English for Interviews" — all still the same language course.
    - **Descriptive disambiguators**: "The Matrix (1999 film)", "The Matrix (Keanu Reeves film)" — these clarify which subject, they don’t change it.
  - **Decision checklist**:
    - Is this a genuinely different technology, framework, or established field with its own identity? If yes → exclude.
    - Does it expand to an umbrella domain that encompasses other unrelated subjects? If yes → broader → exclude.
    - Would we want the AI to create a separate course for this title? If no → include as alternative.
  - **Concrete examples**:
    - **Include**: "Client‑Side Web Development" / "UI Development" ↔ "Frontend Development"; "Python for Data Science" / "Python for Web Development" / "Python for Automation" ↔ "Python"; "ML with Python" / "ML with TensorFlow" ↔ "Machine Learning"; "Differential Calculus" / "Integral Calculus" ↔ "Calculus"; "Formula 1 Motorsport" / "F1 Racing" ↔ "Formula 1"; "Full Stack Web Development" ↔ "Web Development"; "Inglês Técnico" / "Business English" ↔ "Inglês"; "Data Science Certification Prep" ↔ "Data Science"; "The Matrix (1999 film)" ↔ "The Matrix"; "IA para Desenvolvedores" ↔ "Inteligência Artificial"; "WWII" / "Second World War" ↔ "World War II"; "UX Design Principles" ↔ "UX Design".
    - **Exclude**: "Web Development" (broader than "Frontend Development"); "Programming" (broader than "Python"); "Aprendizado de Máquina" (different field from "Inteligência Artificial"); "React" (different technology from "JavaScript"); "Deep Learning" (different specialized field from "Machine Learning"); standalone "Motorsport" (broader than "Formula 1"); "Mathematics" (broader than "Calculus"); just "Matrix" (ambiguous).
  - Include different locale spellings when applicable (e.g., "Optimization" and "Optimisation").
  - Include abbreviations if they mean the same thing (e.g., "AI"/"IA", "ML" when base is "Machine Learning").
  - Levels like "Beginner", "Advanced", "Calculus 1", "101", etc., are acceptable if they keep the same subject.
  - It’s fine to skip spacing/hyphenation/accents variants — serialization will handle those.
  - Awkward or redundant phrasings are acceptable.
  - Ignore casing issues (e.g., "javascript" vs "JavaScript").
  - Well-known English terms in non-English titles are acceptable (e.g., "Business English" in Portuguese, "TOEFL", "IELTS").
  - For language courses: all learning aspects (grammar, vocabulary, pronunciation, exam prep, professional contexts) map to the same course.
  - Ideally, it should have a huge list of alternative titles, really good ones have more than 100 alternative titles

  SCORING CALIBRATION:
  - The duplicate-prevention purpose above is the PRIMARY lens. Ask: "Would we want a separate course for this title, or is it the same subject?"
  - Penalize for INCORRECT inclusions (titles that should genuinely be separate courses) or INCORRECT exclusions (titles that are clearly the same subject).
  - Do NOT penalize for application context variants ("X for Y") or tool-specific framing ("X with Y") — these are the same course.
  - Do NOT heavily penalize for missing titles you expected — only penalize for wrong inclusion/exclusion decisions.
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
      - Should NOT include standalone "Programación" (broader) or standalone "Frontend" / "Backend" (different subjects)
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
      - Descriptive disambiguators are acceptable: "The Matrix (1999 film)", "The Matrix (Keanu Reeves film)", "The Matrix (bullet time film)" — these clarify which subject, they don't change it
      - Should NOT include just "Matrix" (ambiguous — could refer to mathematics, the movie, etc.)
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
