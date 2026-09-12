import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCourseDiscovery } from "./course-discovery";
import { generateCoursePath } from "./course-path";
import { resolveLearningRequest } from "./course-request";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./course-discovery.prompt.md", () => ({ default: "Discovery" }));
vi.mock("./course-path.prompt.md", () => ({ default: "Path" }));
vi.mock("./course-intent.prompt.md", () => ({ default: "Intent" }));
vi.mock("./course-request.prompt.md", () => ({ default: "Request" }));

/** Only the paid model boundary is replaced; result validation remains real. */
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function modelResult(output: unknown) {
  vi.mocked(generateText).mockResolvedValueOnce({ output, usage: {} } as Awaited<
    ReturnType<typeof generateText>
  >);
}

const pathInput = {
  chapters: [
    {
      description: "Read a function.",
      id: "functions",
      level: "basic",
      prerequisiteIds: [],
      title: "Functions",
    },
    {
      description: "Find a bug.",
      id: "debugging",
      level: "basic",
      prerequisiteIds: ["functions"],
      title: "Debugging",
    },
  ],
  courseTitle: "Python",
  depth: "focused" as const,
  goal: "Fix small programs",
  language: "en",
  selectedLevel: "basic",
  startingKnowledge: "Can read simple code",
};

describe("learning request generation boundaries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not pass model-authored subjects through an unsupported intent", async () => {
    modelResult({
      intent: "unsafe",
      subjects: [
        {
          format: "core",
          prompt: "Chemistry",
          requiresDiscovery: false,
          targetLanguage: null,
          title: "Chemistry",
        },
      ],
      trackTitle: "Study",
    });

    const result = await resolveLearningRequest({ language: "en", prompt: "A harmful request" });
    expect(result.data).toStrictEqual({ intent: "unsafe", subjects: [], trackTitle: null });
  });

  it("rejects duplicate subjects before they can create duplicate course work", async () => {
    const subject = {
      format: "core",
      prompt: "Physics",
      requiresDiscovery: false,
      targetLanguage: null,
      title: "Physics",
    };

    modelResult({
      intent: "learn",
      subjects: [subject, { ...subject, title: " physics " }],
      trackTitle: "Physics",
    });

    await expect(
      resolveLearningRequest({ language: "en", prompt: "Physics and physics" }),
    ).rejects.toThrow("duplicate subjects");
  });

  it("rejects path resources outside the provided curriculum", async () => {
    modelResult({ chapterIds: ["functions", "private-other-course"], summary: "Read and debug" });
    await expect(generateCoursePath(pathInput)).rejects.toThrow("outside the supplied curriculum");
  });

  it("rejects repeated chapters rather than presenting false progress", async () => {
    modelResult({ chapterIds: ["functions", "functions"], summary: "Read twice" });
    await expect(generateCoursePath(pathInput)).rejects.toThrow("repeats a chapter");
  });

  it("preserves the selected chapter order", async () => {
    modelResult({
      chapterIds: ["functions", "debugging"],
      summary: "Read and debug small programs",
    });

    const result = await generateCoursePath(pathInput);
    expect(result.data.chapterIds).toStrictEqual(["functions", "debugging"]);
  });

  it("can ask another useful question after a long discovery transcript", async () => {
    const answers = Array.from({ length: 12 }, (_, index) => ({
      answer: "A material requirement",
      question: "Earlier requirement",
      questionId: `requirement-${index}`,
    }));

    discoveryModelResult({
      brief: null,
      format: null,
      question: {
        description: "The available tools change the useful practice.",
        id: "available-tools",
        optional: false,
        options: [
          { description: "", id: "hand", label: "Hand tools" },
          { description: "", id: "machine", label: "Machine tools" },
        ],
        question: "Which tools can you use?",
      },
      reusableCoursePrompt: null,
      status: "ask",
      targetLanguage: null,
    });

    const result = await generateCourseDiscovery({
      answers,
      language: "en",
      prompt: "Teach me a constrained craft project",
    });

    expect(result.data.question?.id).toBe("available-tools");

    expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-5.6-luna",
      providerOptions: { gateway: { models: [] } },
    });
  });

  it("rejects a discovery loop instead of asking an answered question again", async () => {
    discoveryModelResult({
      brief: null,
      format: null,
      question: {
        description: "",
        id: "experience",
        optional: false,
        options: [
          { description: "", id: "new", label: "New" },
          { description: "", id: "some", label: "Some experience" },
        ],
        question: "What do you know?",
      },
      reusableCoursePrompt: null,
      status: "ask",
      targetLanguage: null,
    });

    await expect(
      generateCourseDiscovery({
        answers: [{ answer: "New", question: "What do you know?", questionId: "experience" }],
        language: "en",
        prompt: "A custom project",
      }),
    ).rejects.toThrow("repeated an answered question");
  });

  it("does not allow a private brief to also become a reusable subject", async () => {
    discoveryModelResult({
      brief: {
        description: "A private project",
        learningGoal: "Build it",
        requirements: ["Private data"],
        startingKnowledge: "New",
        title: "Project",
      },
      format: "personalized",
      question: null,
      reusableCoursePrompt: "Build the learner's private project",
      status: "ready",
      targetLanguage: null,
    });

    await expect(
      generateCourseDiscovery({ answers: [], language: "en", prompt: "A private project" }),
    ).rejects.toThrow("reusable subject prompt");
  });
});

function discoveryModelResult(data: unknown) {
  modelResult({ decision: data });
}
