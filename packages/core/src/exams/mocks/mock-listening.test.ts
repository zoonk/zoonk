import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  listeningContent,
  listeningGoalFixture,
  listeningSetFixture,
} from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { listListeningParts } from "../listening/listening-parts";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { mockConditionsSchema } from "./mock-contract";
import { recordMockPlay } from "./record-mock-play";
import { requestMockQuestions } from "./request-mock-questions";
import { startAnytimeMock } from "./start-anytime-mock";
import { submitMockSection } from "./submit-mock-section";

const FULL = { area: null, day: null, kind: "full" } as const;
const READING_QUESTIONS = 5;

/**
 * An IELTS-like learner on Plus: a Reading section with a few questions in the bank and a
 * Listening section of two parts, each with a voiced recording of two questions unless `voiced`
 * says which parts have one; `readingQuestions` in the bank for Reading's 40.
 */
async function listeningSetup({
  readingQuestions = READING_QUESTIONS,
  voiced = [true, true],
}: { readingQuestions?: number; voiced?: boolean[] } = {}) {
  const fixture = await listeningGoalFixture();
  const { blueprint, goal, listeningSkills, plan, reading, user } = fixture;
  const parts = listListeningParts(readBlueprintContent(blueprint).structure);

  const recordings = await Promise.all(
    parts.map(async (part, index) => {
      const media = voiced[index] ? await mediaAssetFixture() : null;

      const set = await listeningSetFixture({
        content: { ...listeningContent(), task: part.task },
        examBlueprintId: blueprint.id,
        mediaAssetId: media?.id ?? null,
      });

      const questions = await Promise.all(
        [0, 1].map((position) =>
          itemFixture({
            content: choiceItemContent(`Part ${index + 1}, question ${position + 1}?`),
            examBlueprintId: blueprint.id,
            setId: set.id,
            setPosition: position,
            skillId: listeningSkills[index % listeningSkills.length]?.id ?? "",
          }),
        ),
      );

      return { questions, set };
    }),
  );

  await Promise.all([
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: reading.id }),
    ...Array.from({ length: readingQuestions }, () =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: reading.id,
      }),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  return { goal, reading, recordings };
}

describe("a mock's listening section", () => {
  it("plays the exam's recordings, every question of each in order, and leaves nothing out for them", async () => {
    const { goal, recordings } = await listeningSetup();

    const options = await getMockOptions({ goalId: goal.id });

    const full =
      options.status === "ready"
        ? options.view.options.find((option) => option.kind === "full")
        : null;

    expect(full?.leftOut.map((part) => part.part)).not.toContain("listening");

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { acceptFewer: true, shape: FULL, timeZone: "UTC" },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const stored = await prisma.mockExam.findUniqueOrThrow({ where: { id: started.id } });
    const { sections } = mockConditionsSchema.parse(stored.conditions);

    expect(sections.map((section) => [section.name, section.kind ?? null])).toStrictEqual([
      ["Reading", null],
      ["Listening", "listening"],
    ]);

    expect(sections[1]?.itemIds).toStrictEqual(
      recordings.flatMap((recording) => recording.questions.map((question) => question.id)),
    );

    const result = await getMock(started.id);

    expect(result.status === "ready" && result.mock.leftOut.map((part) => part.part)).not.toContain(
      "listening",
    );
  });

  it("writes a part's missing recording when the mock starts, and leaves the section out, saying so, when it couldn't", async () => {
    const { goal } = await listeningSetup({ voiced: [true, false] });

    const options = await getMockOptions({ goalId: goal.id });

    const full =
      options.status === "ready"
        ? options.view.options.find((option) => option.kind === "full")
        : null;

    // The full mock sits the listening paper: starting it writes the recording it lacks.
    expect(full?.leftOut).not.toContainEqual({ name: "Listening", part: "listening" });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { shape: FULL } }),
    ).resolves.toMatchObject({ listening: true, status: "start" });

    // When the recording couldn't be written, the mock sits the rest and says what it leaves out.
    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { acceptFewer: true, shape: FULL, timeZone: "UTC" },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const stored = await prisma.mockExam.findUniqueOrThrow({ where: { id: started.id } });
    const { sections } = mockConditionsSchema.parse(stored.conditions);

    expect(sections.map((section) => section.name)).toStrictEqual(["Reading"]);

    const mock = await getMock(started.id);

    expect(mock.status === "ready" && mock.mock.leftOut).toContainEqual({
      name: "Listening",
      part: "listening",
    });
  });

  it("asks for a full mock's missing recording even when the bank holds its written questions", async () => {
    // The Reading paper's 40 questions are all in the bank.
    const { goal } = await listeningSetup({ readingQuestions: 40, voiced: [false, false] });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: FULL, timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ status: "needsQuestions" });
  });

  it("has written questions written only for the other sections' skills: listening is asked on recordings", async () => {
    const { goal, reading } = await listeningSetup();

    const request = await requestMockQuestions({ goalId: goal.id, input: { shape: FULL } });

    expect(request).toMatchObject({ listening: false, status: "start" });

    expect(
      request.status === "start" && request.writes.flatMap((write) => write.skillIds),
    ).toStrictEqual([reading.id]);
  });

  it("counts each recording's plays on the mock, so no other tab or device plays one past the exam's limit", async () => {
    const { goal, recordings } = await listeningSetup();
    const [first, second] = recordings.map((recording) => recording.set.id);

    if (!first || !second) {
      throw new Error("Expected two recordings");
    }

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { acceptFewer: true, shape: FULL, timeZone: "UTC" },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const blockId = started.id;

    // Reading runs first: its recordings wait for the listening section.
    await expect(recordMockPlay({ blockId, setId: first })).resolves.toStrictEqual({
      status: "invalidSet",
    });

    await submitMockSection({ blockId, input: { timeZone: "UTC" }, section: 0 });

    await expect(recordMockPlay({ blockId, setId: first })).resolves.toStrictEqual({
      played: 1,
      status: "counted",
    });

    // The exam plays it once: another page that didn't know gets no second play.
    await expect(recordMockPlay({ blockId, setId: first })).resolves.toStrictEqual({
      played: 1,
      status: "usedUp",
    });

    // Two pages starting the same recording at once: only one gets the play.
    const both = await Promise.all([
      recordMockPlay({ blockId, setId: second }),
      recordMockPlay({ blockId, setId: second }),
    ]);

    expect(both.map((result) => result.status).toSorted()).toStrictEqual(["counted", "usedUp"]);

    // Only the two counted plays changed what the recordings' screens show.

    // Any tab or device opens the section with the plays already used.
    const result = await getMock(blockId);

    expect(
      result.status === "ready" &&
        result.mock.current?.plays.toSorted((a, b) => a.setId.localeCompare(b.setId)),
    ).toStrictEqual(
      [
        { played: 1, setId: first },
        { played: 1, setId: second },
      ].toSorted((a, b) => a.setId.localeCompare(b.setId)),
    );

    // A recording the mock doesn't ask is never counted on it.
    const other = await listeningSetFixture({ content: listeningContent() });

    await expect(recordMockPlay({ blockId, setId: other.id })).resolves.toStrictEqual({
      status: "invalidSet",
    });
  });
});
