import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { describe, expect, test, vi } from "vitest";
import { generateStoryImagesStep } from "./generate-story-images-step";
import { type LessonActivity } from "./get-lesson-activities-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

const { generateStepImagesMock } = vi.hoisted(() => ({ generateStepImagesMock: vi.fn() }));

vi.mock("./_utils/generate-step-images", () => ({ generateStepImages: generateStepImagesMock }));

const activity = {
  id: "story-activity",
  kind: "story",
  language: "en",
  lesson: { chapter: { course: { organization: { slug: AI_ORG_SLUG } } } },
} as LessonActivity;

describe(generateStoryImagesStep, () => {
  test("groups scene, state, and outcome images back into story order", async () => {
    const storyData = {
      intro: "You walk onto a troubled factory floor.",
      introImagePrompt: "Factory floor with anxious workers waiting for direction",
      metrics: ["Production", "Morale"],
      outcomes: {
        bad: {
          imagePrompt: "Factory floor partly stabilized but still visibly strained",
          narrative: "Mixed result.",
          title: "Mixed",
        },
        good: {
          imagePrompt: "Factory floor stabilizing with only minor delays left",
          narrative: "Mostly resolved.",
          title: "Good",
        },
        ok: {
          imagePrompt: "Factory floor moving again while a few stations remain backed up",
          narrative: "Partial recovery.",
          title: "Okay",
        },
        perfect: {
          imagePrompt: "Recovered factory floor with calm workers and steady output",
          narrative: "Well done.",
          title: "Great",
        },
        terrible: {
          imagePrompt: "Factory floor still strained with missed output and tired workers",
          narrative: "Needs work.",
          title: "Okay",
        },
      },
      steps: [
        {
          choices: [
            {
              alignment: "strong" as const,
              consequence: "Workers rally.",
              label: "Address the team",
              metricEffects: [{ effect: "positive" as const, metric: "Morale" }],
              stateImagePrompt: "Factory floor after a direct address calms the team",
            },
            {
              alignment: "weak" as const,
              consequence: "Rumors spread.",
              label: "Send an email",
              metricEffects: [{ effect: "negative" as const, metric: "Morale" }],
              stateImagePrompt: "Factory floor after a vague email leaves workers confused",
            },
          ],
          imagePrompt: "Factory floor with halted lines and empty parts bins",
          problem: "Your supplier went bankrupt.",
        },
      ],
      title: "The night the labels got swapped",
    };

    generateStepImagesMock.mockResolvedValueOnce([
      { prompt: "Intro", url: "https://example.com/intro.webp" },
      { prompt: "Step 1", url: "https://example.com/step-1.webp" },
      { prompt: "State 1", url: "https://example.com/state-1.webp" },
      { prompt: "State 2", url: "https://example.com/state-2.webp" },
      { prompt: "Outcome 1", url: "https://example.com/outcome-1.webp" },
      { prompt: "Outcome 2", url: "https://example.com/outcome-2.webp" },
      { prompt: "Outcome 3", url: "https://example.com/outcome-3.webp" },
      { prompt: "Outcome 4", url: "https://example.com/outcome-4.webp" },
      { prompt: "Outcome 5", url: "https://example.com/outcome-5.webp" },
    ]);

    const result = await generateStoryImagesStep({
      activity,
      storyData,
    });

    expect(generateStepImagesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        preset: "story",
        prompts: [
          "Factory floor with anxious workers waiting for direction",
          "Factory floor with halted lines and empty parts bins",
          "Factory floor after a direct address calms the team",
          "Factory floor after a vague email leaves workers confused",
          "Recovered factory floor with calm workers and steady output",
          "Factory floor stabilizing with only minor delays left",
          "Factory floor moving again while a few stations remain backed up",
          "Factory floor partly stabilized but still visibly strained",
          "Factory floor still strained with missed output and tired workers",
        ],
      }),
    );

    expect(result).toEqual({
      choiceStateImages: [
        [
          { prompt: "State 1", url: "https://example.com/state-1.webp" },
          { prompt: "State 2", url: "https://example.com/state-2.webp" },
        ],
      ],
      introImage: { prompt: "Intro", url: "https://example.com/intro.webp" },
      outcomeImages: {
        bad: { prompt: "Outcome 4", url: "https://example.com/outcome-4.webp" },
        good: { prompt: "Outcome 2", url: "https://example.com/outcome-2.webp" },
        ok: { prompt: "Outcome 3", url: "https://example.com/outcome-3.webp" },
        perfect: { prompt: "Outcome 1", url: "https://example.com/outcome-1.webp" },
        terrible: { prompt: "Outcome 5", url: "https://example.com/outcome-5.webp" },
      },
      stepImages: [{ prompt: "Step 1", url: "https://example.com/step-1.webp" }],
    });
  });
});
