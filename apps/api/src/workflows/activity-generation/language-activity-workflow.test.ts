import { beforeEach, describe, expect, test, vi } from "vitest";
import { grammarActivityWorkflow } from "./kinds/grammar-workflow";
import { listeningActivityWorkflow } from "./kinds/listening-workflow";
import { readingActivityWorkflow } from "./kinds/reading-workflow";
import { vocabularyActivityWorkflow } from "./kinds/vocabulary-workflow";
import { languageActivityWorkflow } from "./language-activity-workflow";
import { getNeighboringConceptsStep } from "./steps/get-neighboring-concepts-step";

vi.mock("./kinds/grammar-workflow", () => ({
  grammarActivityWorkflow: vi.fn(async () => {}),
}));

vi.mock("./kinds/listening-workflow", () => ({
  listeningActivityWorkflow: vi.fn(async () => {}),
}));

vi.mock("./kinds/reading-workflow", () => ({
  readingActivityWorkflow: vi.fn(async () => {}),
}));

vi.mock("./kinds/vocabulary-workflow", () => ({
  vocabularyActivityWorkflow: vi.fn().mockResolvedValue({
    words: [{ translation: "hello", word: "hola" }],
  }),
}));

vi.mock("./steps/get-neighboring-concepts-step", () => ({
  getNeighboringConceptsStep: vi.fn().mockResolvedValue(["greetings"]),
}));

function makeActivity(kind: string) {
  return {
    id: kind,
    kind,
    lesson: { concepts: ["intro"], kind: "language" },
  };
}

describe(languageActivityWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("passes concepts, neighboring concepts, and vocabulary words downstream", async () => {
    const allActivities = [
      makeActivity("vocabulary"),
      makeActivity("reading"),
      makeActivity("listening"),
    ];
    const activitiesToGenerate = [makeActivity("vocabulary"), makeActivity("reading")];

    await languageActivityWorkflow({
      activitiesToGenerate: activitiesToGenerate as never,
      allActivities: allActivities as never,
      workflowRunId: "workflow-1",
    });

    expect(getNeighboringConceptsStep).toHaveBeenCalledWith(allActivities);
    expect(vocabularyActivityWorkflow).toHaveBeenCalledWith({
      activitiesToGenerate,
      allActivities,
      concepts: ["intro"],
      neighboringConcepts: ["greetings"],
      workflowRunId: "workflow-1",
    });
    expect(grammarActivityWorkflow).toHaveBeenCalledWith({
      activitiesToGenerate,
      concepts: ["intro"],
      neighboringConcepts: ["greetings"],
      workflowRunId: "workflow-1",
    });
    expect(readingActivityWorkflow).toHaveBeenCalledWith({
      activitiesToGenerate,
      allActivities,
      concepts: ["intro"],
      neighboringConcepts: ["greetings"],
      words: [{ translation: "hello", word: "hola" }],
      workflowRunId: "workflow-1",
    });
    expect(listeningActivityWorkflow).toHaveBeenCalledWith({
      allActivities,
      workflowRunId: "workflow-1",
    });
  });

  test("falls back to empty vocabulary words when vocabulary generation fails", async () => {
    vi.mocked(vocabularyActivityWorkflow).mockRejectedValueOnce(new Error("vocabulary failed"));

    const activities = [makeActivity("reading")];

    await languageActivityWorkflow({
      activitiesToGenerate: activities as never,
      allActivities: activities as never,
      workflowRunId: "workflow-2",
    });

    expect(grammarActivityWorkflow).toHaveBeenCalledOnce();
    expect(readingActivityWorkflow).toHaveBeenCalledWith({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts: ["intro"],
      neighboringConcepts: ["greetings"],
      words: [],
      workflowRunId: "workflow-2",
    });
    expect(listeningActivityWorkflow).toHaveBeenCalledOnce();
  });

  test("passes empty current-run vocabulary words to reading when vocabulary returns none", async () => {
    vi.mocked(vocabularyActivityWorkflow).mockResolvedValueOnce({ words: [] });

    const activities = [makeActivity("reading"), makeActivity("listening")];

    await languageActivityWorkflow({
      activitiesToGenerate: activities as never,
      allActivities: activities as never,
      workflowRunId: "workflow-empty-current-vocab",
    });

    expect(readingActivityWorkflow).toHaveBeenCalledWith({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts: ["intro"],
      neighboringConcepts: ["greetings"],
      words: [],
      workflowRunId: "workflow-empty-current-vocab",
    });
    expect(listeningActivityWorkflow).toHaveBeenCalledWith({
      allActivities: activities,
      workflowRunId: "workflow-empty-current-vocab",
    });
  });

  test("continues reading and listening when grammar generation fails", async () => {
    vi.mocked(grammarActivityWorkflow).mockRejectedValueOnce(new Error("grammar failed"));

    const activities = [makeActivity("vocabulary"), makeActivity("reading")];

    await languageActivityWorkflow({
      activitiesToGenerate: activities as never,
      allActivities: activities as never,
      workflowRunId: "workflow-3",
    });

    expect(vocabularyActivityWorkflow).toHaveBeenCalledOnce();
    expect(readingActivityWorkflow).toHaveBeenCalledWith({
      activitiesToGenerate: activities,
      allActivities: activities,
      concepts: ["intro"],
      neighboringConcepts: ["greetings"],
      words: [{ translation: "hello", word: "hola" }],
      workflowRunId: "workflow-3",
    });
    expect(listeningActivityWorkflow).toHaveBeenCalledWith({
      allActivities: activities,
      workflowRunId: "workflow-3",
    });
  });
});
