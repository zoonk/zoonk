import { beforeEach, describe, expect, test, vi } from "vitest";
import { saveListeningLessonStep } from "../steps/save-listening-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { listeningLessonWorkflow } from "./listening-workflow";

vi.mock("../steps/save-listening-lesson-step", () => ({
  saveListeningLessonStep: vi.fn(),
}));

describe(listeningLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("delegates listening lessons to the listening save step", async () => {
    const context = await createKindWorkflowContext();

    await listeningLessonWorkflow(context);

    expect(saveListeningLessonStep).toHaveBeenCalledExactlyOnceWith(context);
  });
});
