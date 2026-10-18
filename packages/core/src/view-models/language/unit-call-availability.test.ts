import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageUnitView } from "./get-language-unit-view";

// Provider availability is an external deployment boundary; the view still reads real learner data.
vi.mock("@zoonk/ai/tasks/v2/language/live-call-session", () => ({
  isLiveCallAvailable: vi.fn(() => false),
}));

describe("unit call availability", () => {
  it("reports a provider pause before the learner chooses a call length", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const result = await getLanguageUnitView({ chapterId: renting.id });
    expect(result).toMatchObject({ status: "ready", unit: { conversation: { paused: true } } });
  });
});
