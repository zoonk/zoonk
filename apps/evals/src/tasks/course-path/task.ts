import { type Task } from "@/lib/types";
import { generateCoursePath } from "@zoonk/ai/tasks/courses/path";

type Input = Parameters<typeof generateCoursePath>[0];
export const coursePathTask: Task<Input, Awaited<ReturnType<typeof generateCoursePath>>["data"]> = {
  description: "Choose a focused path through existing chapters without inventing new content",
  generate: generateCoursePath,
  id: "course-path",
  name: "Course Path",
  testCases: [
    {
      expectations:
        "Select only supplied unique chapter IDs, prioritize testing/debugging/AI review for the stated outcome, and omit unrelated metaclass depth. Keep prerequisite order. Existing knowledge can justify beginning beyond introductory material, but do not invent course chapters or rewrite reusable content.",
      id: "python-work-with-agents",
      userInput: {
        chapters: [
          {
            description: "Read inputs, work and return values",
            id: "functions",
            level: "basic",
            prerequisiteIds: [],
            title: "Functions",
          },
          {
            description: "Check behavior with useful automated tests",
            id: "testing",
            level: "intermediate",
            prerequisiteIds: ["functions"],
            title: "Testing behavior",
          },
          {
            description: "Find the cause of incorrect behavior",
            id: "debugging",
            level: "intermediate",
            prerequisiteIds: ["functions"],
            title: "Debugging",
          },
          {
            description: "Specify requirements, inspect a patch and verify its behavior",
            id: "ai-review",
            level: "intermediate",
            prerequisiteIds: ["testing", "debugging"],
            title: "Review AI-generated code",
          },
          {
            description: "Change how classes are constructed",
            id: "metaclasses",
            level: "advanced",
            prerequisiteIds: ["functions"],
            title: "Metaclasses",
          },
        ],
        courseTitle: "Python",
        depth: "focused",
        goal: "Review and debug Python code written with an AI agent",
        language: "en",
        selectedLevel: "intermediate",
        startingKnowledge: "Comfortable reading functions and simple scripts",
      },
    },
  ],
};
