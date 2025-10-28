const SHARED_EXPECTATIONS = `
  - Focus only on title field, no need to pay attention to the description
  - It's okay for description to have issues, focus on the title
  - The description should NOT have an impact on scoring unless it's written in the wrong language
  - Title should NOT have level/joiner words like "basic", "intermediate", "advanced", "fundamentals", etc
  - Title should NOT have words like "course" in the title
  - Title cases are not important (e.g., both "física" and "Física" are acceptable)
  - Not following title guidelines is a major error
`;

export const TEST_CASES = [
  {
    expectations: `
      - titles should include broad topics like "Ciência da Computação", "Programação", "Desenvolvimento de Software"
      - may include other related topics to coding and programming
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-want-to-code",
    userInput: {
      locale: "pt",
      prompt: "I want to code",
    },
  },
  {
    expectations: `
      - should include "Black Holes" in the first result
      - should include broader topics like "Astrophysics"
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-black-holes",
    userInput: {
      locale: "en",
      prompt: "quero aprender sobre buracos negros",
    },
  },
  {
    expectations: `
      - should include "Derecho Penal"
      - may include broader or similar topics
      - all titles and descriptions in Spain Spanish

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-derecho-penal",
    userInput: {
      locale: "es",
      prompt: "derecho penal",
    },
  },
  {
    expectations: `
      - should include "Derecho Chileno" since the user is specifically asking for Chilean law
      - if including related topics, they should be specific to Chilean law, not general Spanish law
      - all titles and descriptions in Spain Spanish (not Chilean Spanish) since that's the default for "es" locale

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-derecho-chileno",
    userInput: {
      locale: "es",
      prompt: "derecho chileno",
    },
  },
  {
    expectations: `
      - should ONLY include "TOEFL" and "Inglês"
      - all titles and descriptions in Brazilian Portuguese
      - no extra titles like "Testes de Proficiência em Inglês", "Preparatório para o TOEFL", etc

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-toefl",
    userInput: {
      locale: "pt",
      prompt: "quero passar no TOEFL",
    },
  },
  {
    expectations: `
      - should include both "Física" and "Química"
      - should NOT include "Física e Química" as a single title
      - may include broader or similar topics but it's not required
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-physics-and-chemistry",
    userInput: {
      locale: "pt",
      prompt: "physics and chemistry",
    },
  },
  {
    expectations: `
      - should include "Chemistry" (this is very important, not including it is a major error)
      - do NOT include "Intro to Chemistry" or "Introduction to Chemistry"
      - may include broader or similar topics but it's not required
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-intro-to-chemistry",
    userInput: {
      locale: "en",
      prompt: "i want an intro to chemistry",
    },
  },
  {
    expectations: `
      - should include "Dragon Ball", fixing the typo in the input
      - optionally, may include broader alts like "Animação", "Cultura Pop" or related suggestions
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-dragon-ball",
    userInput: {
      locale: "pt",
      prompt: "dragon bals",
    },
  },
  {
    expectations: `
      - should include "Beatles" or "The Beatles"
      - optionally, may include broader alts like "Rock", "Music History" or related suggestions
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-beatles",
    userInput: {
      locale: "en",
      prompt: "beatles",
    },
  },
  {
    expectations: `
      - should include "Formule 1" or "F1"
      - optionally, may include broader alts like "Sport Automobile", "Courses de Voitures" or related suggestions
      - all titles and descriptions in France French

      ${SHARED_EXPECTATIONS}
    `,
    id: "fr-f1",
    userInput: {
      locale: "fr",
      prompt: "f1",
    },
  },
  {
    expectations: `
      - should include "JLPT" without the "N2" level suffix
      - should include "Japanese", not "Japanese Language" (adding a "language" suffix is a major error)
      - all titles and descriptions in US English
      - no extra titles like "Japanese Language Proficiency Test", "JLPT N2 Preparation", etc
      - should NOT include any other suggestions

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-jlpt-n2",
    userInput: {
      locale: "en",
      prompt: "i want to pass the JLPT N2",
    },
  },
  {
    expectations: `
      - should ONLY include "IELTS" and "Inglês", strip "Academic" suffix
      - all titles and descriptions in Brazilian Portuguese
      - no extra titles like "Testes de Proficiência em Inglês", "Preparatório para o IELTS", etc
      - should NOT include any other suggestions

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ielts-academic",
    userInput: {
      locale: "pt",
      prompt: "quero passar no IELTS Academic",
    },
  },
  {
    expectations: `
      - should include broad courses like "Computer Science", "Computer Architecture", etc
      - extra related topics are fine but their absence is also fine
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-how-computers-work",
    userInput: {
      locale: "en",
      prompt: "how do computers work",
    },
  },
  {
    expectations: `
      - should include "Tabela Periódica"
      - should NOT include an article title like "A Tabela Periódica"
      - may include other chemistry-related topics and broad suggestions like "Química"
      - all titles and descriptions in Brazilian Portuguese

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-periodic-table",
    userInput: {
      locale: "pt",
      prompt: "tabela periódica",
    },
  },
  {
    expectations: `
      - first result should be the exact movie title: "The Matrix"
      - may include other sci-fi related topics and broad suggestions
      - may include broader film-related suggestions
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-matrix-movie",
    userInput: {
      locale: "en",
      prompt: "matrix movie",
    },
  },
  {
    expectations: `
      - should include "Artificial Intelligence" (not "AI" abbreviation in the title)
      - may include other AI-related topics and broad suggestions
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ai",
    userInput: {
      locale: "en",
      prompt: "ai",
    },
  },
  {
    expectations: `
      - should include the exact book title ("The Wealth of Nations") since the user is specifically asking for this book
      - should include broader or similar topics
      - all titles and descriptions in US English

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-wealth-of-nations",
    userInput: {
      locale: "en",
      prompt: "wealth of nations",
    },
  },
];
