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
import { pickListeningSets } from "../listening/pick-listening-sets";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { mockConditionsSchema } from "./mock-contract";
import { listDueMockGoals, listMockPrepWrites } from "./prepare-mock-questions";
import { recordMockPlay } from "./record-mock-play";
import { startAnytimeMock } from "./start-anytime-mock";
import { submitMockSection } from "./submit-mock-section";

const FULL = { area: null, day: null, kind: "full" } as const;
const READING_QUESTIONS = 40;

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
        mockOnly: true,
      });

      const questions = await Promise.all(
        [0, 1].map((position) =>
          itemFixture({
            content: choiceItemContent(`Part ${index + 1}, question ${position + 1}?`),
            examBlueprintId: blueprint.id,
            mockOnly: true,
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
        mockOnly: true,
        skillId: reading.id,
      }),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  return { blueprint, goal, parts, plan, reading, recordings };
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

    const started = await startAnytimeMock({ goalId: goal.id, input: { shape: FULL } });

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

  it("requests the missing recording and keeps the full mock preparing", async () => {
    const { goal } = await listeningSetup({ voiced: [true, false] });

    const options = await getMockOptions({ goalId: goal.id });

    const full =
      options.status === "ready"
        ? options.view.options.find((option) => option.kind === "full")
        : null;

    expect(full?.leftOut).not.toContainEqual({ name: "Listening", part: "listening" });

    await expect(listMockPrepWrites({ goalId: goal.id })).resolves.toMatchObject({
      recordings: { parts: [{ sectionName: "Listening" }] },
    });

    const started = await startAnytimeMock({ goalId: goal.id, input: { shape: FULL } });

    expect(started.status).toBe("preparing");

    await expect(listMockPrepWrites({ goalId: goal.id })).resolves.toMatchObject({
      learnerWaiting: true,
      urgentShort: true,
    });

    await expect(listDueMockGoals()).resolves.toContainEqual({
      examBlueprintId: goal.examBlueprintId,
      goalId: goal.id,
      later: true,
    });

    await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

  it("reserves a voiced part for the first scheduled paper even when another part is missing", async () => {
    const { goal, parts, plan } = await listeningSetup({ voiced: [true, false] });
    const dates = ["2026-11-22", "2026-11-29"];

    await prisma.plan.update({
      data: {
        settings: {
          mockFunding: dates.map((date) => ({
            contributions: [],
            date,
            day: null,
            fullLength: true,
            minutes: 90,
          })),
        },
      },
      where: { id: plan.id },
    });

    await Promise.all(
      dates.map((date, index) =>
        planItemFixture({
          kind: "mock",
          planId: plan.id,
          position: index + 1,
          scheduledFor: new Date(date),
        }),
      ),
    );

    const request = await listMockPrepWrites({ goalId: goal.id });

    expect(request.recordings?.parts.map((part) => part.task)).toStrictEqual([
      parts[1]?.task,
      parts[0]?.task,
      parts[1]?.task,
      parts[0]?.task,
      parts[1]?.task,
    ]);
  });

  it("a repeated task needs a different recording even within the same paper", async () => {
    const { blueprint, goal, parts, recordings } = await listeningSetup({ readingQuestions: 0 });
    const [part] = parts;

    if (!part) {
      throw new Error("Expected a listening part.");
    }

    const picks = await pickListeningSets({
      examBlueprintId: blueprint.id,
      mockOnly: true,
      parts: [part, part],
      scriptLanguage: "en",
      userId: goal.userId,
    });

    expect(picks.map(({ setId }) => setId)).toStrictEqual([recordings[0]?.set.id, null]);
  });

  it("asks for a full mock's missing recording even when the bank holds its written questions", async () => {
    const { goal } = await listeningSetup({ readingQuestions: 40, voiced: [false, false] });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: FULL } }),
    ).resolves.toStrictEqual({ status: "preparing" });
  });

  it("has written questions written only for the other sections' skills: listening is asked on recordings", async () => {
    const { goal, reading } = await listeningSetup({ readingQuestions: 1 });

    const request = await listMockPrepWrites({ goalId: goal.id });

    expect(request.recordings).toBeUndefined();

    expect(request.writes.flatMap((write) => write.skillIds)).toStrictEqual([reading.id]);
  });

  it("counts each recording's plays on the mock, so no other tab or device plays one past the exam's limit", async () => {
    const { goal, recordings } = await listeningSetup();
    const [first, second] = recordings.map((recording) => recording.set.id);

    if (!first || !second) {
      throw new Error("Expected two recordings");
    }

    const started = await startAnytimeMock({ goalId: goal.id, input: { shape: FULL } });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const blockId = started.id;

    await expect(recordMockPlay({ blockId, setId: first })).resolves.toStrictEqual({
      status: "invalidSet",
    });

    await submitMockSection({ blockId, input: { timeZone: "UTC" }, section: 0 });

    await expect(recordMockPlay({ blockId, setId: first })).resolves.toStrictEqual({
      played: 1,
      status: "counted",
    });

    await expect(recordMockPlay({ blockId, setId: first })).resolves.toStrictEqual({
      played: 1,
      status: "usedUp",
    });

    const both = await Promise.all([
      recordMockPlay({ blockId, setId: second }),
      recordMockPlay({ blockId, setId: second }),
    ]);

    expect(both.map((result) => result.status).toSorted()).toStrictEqual(["counted", "usedUp"]);

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

    const other = await listeningSetFixture({ content: listeningContent() });

    await expect(recordMockPlay({ blockId, setId: other.id })).resolves.toStrictEqual({
      status: "invalidSet",
    });
  });
});
