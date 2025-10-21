const SHARED_EXPECTATIONS = `
  - Lessons are bite-sized and focused on single concepts that could be learned in 2-3 minutes each
  - Do not add lessons that may have been covered in other chapters
`;

export const TEST_CASES = [
  {
    id: "en-ml-supervised-regression",
    userInput: {
      courseTitle: "Machine Learning",
      chapterTitle: "Supervised Learning: Linear Regression",
      locale: "en",
    },
    expectations: `
      - Content in US English
      - Should NOT include broad introductory lessons like "What is Supervised Learning?" (belongs in earlier chapter)
      - Should focus specifically on Linear Regression concepts
      - Should break down complex topics (e.g., separate lessons for cost function, gradient descent steps)

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-fisica-mecanica-newtoniana",
    userInput: {
      courseTitle: "Física Quântica",
      chapterTitle: "Fundamentos: Mecânica Newtoniana",
      locale: "pt",
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Should focus on Newtonian mechanics foundations
      - Should NOT include quantum mechanics concepts (those belong in later chapters)

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "es-historia-reconquista",
    userInput: {
      courseTitle: "Historia de España",
      chapterTitle: "La Reconquista (711-1492)",
      locale: "es",
    },
    expectations: `
      - Content in Spain Spanish
      - Should focus on events within the Reconquista period
      - Should NOT include lessons about earlier Visigothic period or later Colonial era
      - Should break down into specific battles, kingdoms, and key moments

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-matrix-neo-journey",
    userInput: {
      courseTitle: "The Matrix",
      chapterTitle: "Neo's Journey: From Thomas Anderson to The One",
      locale: "en",
    },
    expectations: `
      - Content in US English
      - Should focus on Neo's character arc
      - Should NOT include lessons about other characters' journeys (Trinity, Morpheus)
      - Should NOT include general Matrix world-building (that belongs in other chapters)

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-direito-constitucional-fundamentais",
    userInput: {
      courseTitle: "Direito",
      chapterTitle: "Direito Constitucional: Direitos Fundamentais",
      locale: "pt",
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Should focus on fundamental rights in Brazilian Constitution
      - Should NOT include lessons about constitutional structure or powers (different chapter)
      - Should break down each category of fundamental rights separately

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "en-java-oop-inheritance",
    userInput: {
      courseTitle: "Java",
      chapterTitle: "Object-Oriented Programming: Inheritance",
      locale: "en",
    },
    expectations: `
      - Content in US English
      - Should focus specifically on inheritance concepts
      - Should NOT include polymorphism or encapsulation (those are separate chapters)
      - Should NOT include "What is OOP?" or similar lessons (they belong in earlier chapter)
      - Should break down super keyword, method overriding, abstract classes separately

      ${SHARED_EXPECTATIONS}
    `,
  },
  {
    id: "pt-marketing-seo-onpage",
    userInput: {
      courseTitle: "Marketing Digital",
      chapterTitle: "SEO: Otimização On-Page",
      locale: "pt",
    },
    expectations: `
      - Content in Brazilian Portuguese
      - Should focus specifically on on-page SEO techniques
      - Should NOT include "O que é SEO?" (belongs in earlier chapter)
      - Should NOT include off-page SEO, technical SEO, or link building (different chapters)
      - Should break down each on-page element (title tags, meta descriptions, headers) into separate lessons

      ${SHARED_EXPECTATIONS}
    `,
  },
];
