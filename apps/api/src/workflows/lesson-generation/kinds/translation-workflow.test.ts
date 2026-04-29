import { beforeEach, describe, expect, test, vi } from "vitest";
import { saveTranslationLessonStep } from "../steps/save-translation-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { translationLessonWorkflow } from "./translation-workflow";

vi.mock("../steps/save-translation-lesson-step", () => ({
  saveTranslationLessonStep: vi.fn(),
}));

describe(translationLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("delegates translation lessons to the translation save step", async () => {
    const context = await createKindWorkflowContext();

    await translationLessonWorkflow(context);

    expect(saveTranslationLessonStep).toHaveBeenCalledExactlyOnceWith(context);
  });
});
