/**
 * Test cases for course suggestions evaluation
 */

export interface TestCase {
  id: string;
  locale: string;
  prompt: string;
  expectations: string;
}

export const COURSE_SUGGESTIONS_TEST_CASES: TestCase[] = [
  {
    id: "pt-coding",
    locale: "pt",
    prompt: "I want to code",
    expectations: `
- Titles should look like these: "Programação", "Ciência da Computação", "Desenvolvimento Web", "Engenharia de Software"
- All titles and descriptions in Brazilian Portuguese
- The main focus is the title field, no need to pay much attention to the description field
- No level/joiner words like "basic", "intermediate", "advanced", "fundamentals", etc
- No words like "course" in the title
- Titles are always in Title Case
    `.trim(),
  },
  {
    id: "en-black-holes",
    locale: "en",
    prompt: "quero aprender sobre buracos negros",
    expectations: `
- Suggestions should include "Black Holes"
- Suggestions may include broader topics like "Astrophysics"
- All titles and descriptions in English
- The main focus is the title field, no need to pay much attention to the description field
- No level/joiner words like "basic", "intermediate", "advanced", "fundamentals", etc
- No words like "course" in the title
- Titles are always in Title Case
    `.trim(),
  },
];
