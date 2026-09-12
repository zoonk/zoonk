import { type TestCase } from "@/lib/types";
import { type CourseCurriculumParams } from "@zoonk/ai/tasks/courses/curriculum";

const expectations =
  "Judge useful coverage for the requested explicit level, with distinct chapter boundaries and concrete outcomes. Only Overview is limited to 3–6 chapters; Question has exactly one. Basic, Intermediate, Advanced and CEFR levels must cover their full canonical capabilities without arbitrary caps or padding. Titles and descriptions should be approachable and reflect progressively deeper capabilities. Keys must be unique and prerequisites refer to earlier keys. Do not reward a short survey in place of a complete level. In practical subjects include realistic modern work, verification, debugging and AI tools when relevant without replacing domain fundamentals.";

export const TEST_CASES: TestCase<unknown, CourseCurriculumParams>[] = [
  ...(["overview", "basic", "intermediate", "advanced"] as const).map((level) => ({
    expectations: `${expectations} Overview should make computation, algorithms, software, information and real-world limits understandable without formulas. Deeper levels should have real depth in programming, data structures, systems, networks, data, theory and responsible software practice where appropriate.`,
    id: `computer-science-${level}`,
    userInput: {
      courseTitle: "Computer Science",
      format: "core" as const,
      language: "en",
      level,
      targetLanguage: null,
    },
  })),
  ...(["a1", "a2", "b1", "b2", "c1", "c2"] as const).map((level) => ({
    expectations: `${expectations} Generate the complete German communication capabilities at this CEFR level. Advanced argument, register, nuance, mediation, idiomatic precision and complex interaction belong at C levels. Avoid applying core overview/basic labels or treating every daily situation as a separate tiny chapter.`,
    id: `german-${level}`,
    userInput: {
      courseTitle: "German",
      format: "language" as const,
      language: "en",
      level,
      targetLanguage: "de",
    },
  })),
  {
    expectations: `${expectations} Exactly one chapter answers why the sky looks blue directly and intuitively, explaining scattered sunlight without a broad physics syllabus or preliminary introduction.`,
    id: "question-blue-sky",
    userInput: {
      courseTitle: "Why is the sky blue?",
      format: "question",
      language: "en",
      level: null,
      targetLanguage: null,
    },
  },
  {
    expectations: `${expectations} This is a wholly fictional QA fixture. Follow the specific requested teaching outcome and constraints without making a comprehensive public-speaking or game-design course.`,
    id: "private-fictional-board-game",
    userInput: {
      brief: {
        description: "An invented game and fictional gathering",
        learningGoal: "Teach an invented token-collection game in five minutes",
        requirements: [
          "No slides",
          "Explain the goal before details",
          "Show a sample turn",
          "Let people try the game",
        ],
        startingKnowledge: "Knows the rules but has not taught them",
        title: "Teach a simple board game",
      },
      courseTitle: "Teach a simple board game",
      format: "personalized",
      language: "en",
      level: null,
      targetLanguage: null,
    },
  },
];
