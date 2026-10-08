import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getStudyBlock } from "./get-study-block";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe("study block citations", () => {
  it("dates a question's source for its Sources chip, and keeps a passage without a stored source plain", async () => {
    const checkedAt = new Date("2026-09-12T10:00:00.000Z");
    const url = "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm";

    const [user, skill, law] = await Promise.all([
      userFixture(),
      skillFixture(),
      sourceFixture({ fetchedAt: checkedAt, publisher: "Planalto", title: "Law 8,112", url }),
    ]);

    const [drill, quoted, plain, session] = await Promise.all([
      itemFixture({
        content: choiceItemContent(),
        skillId: skill.id,
        sourceCitation: "Law 8,112, Art. 20",
        sourceId: law.id,
      }),
      itemFixture({
        content: choiceItemContent(),
        skillId: skill.id,
        sourceCitation: "ENEM 2023, question 45",
      }),
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      studySessionFixture({ userId: user.id }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [drill.id, quoted.id, plain.id], skillIds: [skill.id] },
      position: 0,
      sessionId: session.id,
    });

    mockSession(user.id);
    const result = await getStudyBlock({ blockId: block.id, sessionId: session.id });

    expect(
      result.status === "ready" && result.detail.questions.map((question) => question.citation),
    ).toStrictEqual([
      { checkedAt, publisher: "Planalto", text: "Law 8,112, Art. 20", title: "Law 8,112", url },
      { checkedAt: null, publisher: null, text: "ENEM 2023, question 45", title: null, url: null },
      null,
    ]);
  });
});
