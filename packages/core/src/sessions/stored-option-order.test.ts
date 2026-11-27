import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { shownOptionTexts } from "../_test-utils/shown-choice";
import { answerStudyQuestion } from "./answer-study-question";
import { toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";
import { getStudyBlock } from "./get-study-block";

describe("a block made before blocks laid out their own option order", () => {
  it("shows, grades and reviews its questions in the stored order", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const content = choiceItemContent();
    const stored = content.options.map((option) => option.text);
    const item = await itemFixture({ content, skillId: skill.id });
    const storedRight = stored.indexOf("Right answer");

    // A block whose own layout moves the right answer, so grading by it would mark the stored tap wrong.
    const blockId = Array.from({ length: 50 }, () => crypto.randomUUID()).find(
      (id) => shownOptionTexts({ blockId: id, item }).indexOf("Right answer") !== storedRight,
    );

    const session = await studySessionFixture({
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      id: blockId,
      kind: "checkpoint",
      payload: toBlockPayload({
        checkpoint: {
          kind: "boss",
          mock: false,
          passMark: 1,
          phase: 0,
          rematch: false,
          timeLimitMinutes: null,
        },
        itemIds: [item.id],
        storedOptionOrder: true,
      }),
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    });

    mockSession(user.id);

    const detail = await getStudyBlock({ blockId: block.id, sessionId: session.id });
    const shown = detail.status === "ready" ? detail.detail.questions[0]?.options : null;

    expect(shown).toStrictEqual(stored);

    const right = { selectedIndex: storedRight };

    await expect(
      answerStudyQuestion({
        blockId: block.id,
        input: { answer: right, durationMs: 1000, itemId: item.id },
        sessionId: session.id,
      }),
    ).resolves.toMatchObject({ feedback: { isCorrect: true }, status: "ready" });

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({
      completion: { checkpoint: { answers: [{ correctAnswer: right, isCorrect: true }] } },
      status: "ready",
    });
  });
});
