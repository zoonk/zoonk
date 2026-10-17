import { randomUUID } from "node:crypto";
import { writeListeningSet } from "@zoonk/ai/tasks/v2/listening/write-set";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  listeningContent,
  listeningGoalFixture,
  listeningSetFixture,
} from "@zoonk/testing/fixtures/listening";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockWrittenListeningSet } from "../../library/listening/_test-utils/written-listening-set";
import { type ListeningExam, loadListeningExam } from "./listening-exam";
import { loadListeningSkills } from "./listening-skills";
import { MAX_SETS_PER_PART, pickListeningSets } from "./pick-listening-sets";
import { findUnvoicedPartSet, writePartSet } from "./prepare-listening-part";

async function loadExam(goalId: string): Promise<ListeningExam> {
  const exam = await loadListeningExam(goalId);

  if (!exam) {
    throw new Error("Expected the goal's exam to have listening.");
  }

  return exam;
}

function firstPart(exam: ListeningExam) {
  const [part] = exam.parts;

  if (!part) {
    throw new Error("Expected a listening part.");
  }

  return part;
}

/** A stored set of the exam's first part with one question; voiced unless said otherwise. */
async function partSet({
  createdAt,
  exam,
  id,
  voiced = true,
}: {
  createdAt?: Date;
  exam: ListeningExam;
  id?: string;
  voiced?: boolean;
}) {
  const [skill, media] = await Promise.all([skillFixture(), voiced ? mediaAssetFixture() : null]);

  const set = await listeningSetFixture({
    content: {
      ...listeningContent(),
      scriptLanguage: exam.scriptLanguage,
      task: firstPart(exam).task,
    },
    createdAt,
    examBlueprintId: exam.blueprintId,
    id,
    mediaAssetId: media?.id ?? null,
  });

  const item = await prisma.item.create({
    data: {
      content: {
        context: null,
        isTrue: true,
        misconception: null,
        reason: "Said.",
        statement: "x",
      },
      format: "trueFalse",
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: randomUUID(),
      setId: set.id,
      setPosition: 0,
      skillId: skill.id,
    },
  });

  return { item, set };
}

describe(loadListeningExam, () => {
  it("reads a language exam's listening parts from its shared notice reading", async () => {
    const { blueprint, goal } = await listeningGoalFixture();

    await expect(loadListeningExam(goal.id)).resolves.toStrictEqual({
      blueprintId: blueprint.id,
      language: "pt",
      name: blueprint.name,
      parts: [
        {
          count: 2,
          plays: 1,
          sectionName: "Listening",
          task: "Part 1: a conversation between two people in an everyday social context",
        },
        {
          count: 2,
          plays: 2,
          sectionName: "Listening",
          task: "Part 2: one speaker talking about local facilities",
        },
      ],
      scriptLanguage: "en",
    });
  });

  it("has no listening for a goal without a target language or a learner's own notice", async () => {
    const { blueprint, goal, user } = await listeningGoalFixture();

    const noTarget = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await prisma.examBlueprint.update({
      data: { ownerId: user.id, visibility: "private" },
      where: { id: blueprint.id },
    });

    await expect(loadListeningExam(noTarget.id)).resolves.toBeNull();
    await expect(loadListeningExam(goal.id)).resolves.toBeNull();
  });

  it("records in the language the notice says the exam tests, even for a goal that names none", async () => {
    const { blueprint, user } = await listeningGoalFixture();
    const passage = "The test measures your English.";

    const noTarget = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await prisma.examBlueprint.update({
      data: {
        structure: {
          ...(blueprint.structure as object),
          testedLanguage: { citation: { passage, sourceId: "s" }, language: "en" },
        },
      },
      where: { id: blueprint.id },
    });

    await expect(loadListeningExam(noTarget.id)).resolves.toMatchObject({
      blueprintId: blueprint.id,
      scriptLanguage: "en",
    });
  });
});

describe(loadListeningSkills, () => {
  it("gives the skills of the exam graph's area the section names, in the graph's order", async () => {
    const { blueprint, listeningSkills } = await listeningGoalFixture();

    const skills = await loadListeningSkills({
      examBlueprintId: blueprint.id,
      sectionName: "Listening",
    });

    expect(skills.map((skill) => skill.skillId)).toStrictEqual(
      listeningSkills.map((skill) => skill.id),
    );
  });
});

describe(pickListeningSets, () => {
  it("plays a second learner the recording the first one heard, with nothing new to make", async () => {
    const { goal } = await listeningGoalFixture();
    const exam = await loadExam(goal.id);
    const { item, set } = await partSet({ exam });
    const [first, second] = await Promise.all([userFixture(), userFixture()]);

    await attemptFixture({ itemId: item.id, userId: first.id });

    const [secondPick] = await pickListeningSets({
      examBlueprintId: exam.blueprintId,
      parts: exam.parts,
      scriptLanguage: "en",
      userId: second.id,
    });

    expect(secondPick).toMatchObject({ needsSet: false, setId: set.id });
  });

  it("plays unheard sets first, oldest first, then the one heard longest ago, and asks for more", async () => {
    const { goal, user } = await listeningGoalFixture();
    const exam = await loadExam(goal.id);
    const older = await partSet({ createdAt: new Date("2026-09-01T10:00:00Z"), exam });
    const newer = await partSet({ createdAt: new Date("2026-09-02T10:00:00Z"), exam });

    const pick = () =>
      pickListeningSets({
        examBlueprintId: exam.blueprintId,
        parts: exam.parts,
        scriptLanguage: "en",
        userId: user.id,
      });

    await expect(pick()).resolves.toMatchObject([
      { needsSet: false, setId: older.set.id },
      { needsSet: true, setId: null },
    ]);

    await attemptFixture({
      answeredAt: new Date("2026-10-01T10:00:00Z"),
      itemId: newer.item.id,
      userId: user.id,
    });

    await attemptFixture({
      answeredAt: new Date("2026-10-02T10:00:00Z"),
      itemId: older.item.id,
      userId: user.id,
    });

    await expect(pick()).resolves.toMatchObject([{ needsSet: true, setId: newer.set.id }, {}]);
  });

  it("breaks tied creation dates by ID for unheard sets and tied last answers", async () => {
    const { goal, user } = await listeningGoalFixture();
    const exam = await loadExam(goal.id);
    const createdAt = new Date("2026-09-01T10:00:00Z");
    const uniqueId = randomUUID();
    const higher = await partSet({ createdAt, exam, id: `f${uniqueId.slice(1)}` });
    const lower = await partSet({ createdAt, exam, id: `0${uniqueId.slice(1)}` });

    const pick = () =>
      pickListeningSets({
        examBlueprintId: exam.blueprintId,
        parts: exam.parts,
        scriptLanguage: exam.scriptLanguage,
        userId: user.id,
      });

    await expect(pick()).resolves.toMatchObject([{ needsSet: false, setId: lower.set.id }, {}]);

    const answeredAt = new Date("2026-10-01T10:00:00Z");

    await Promise.all([
      attemptFixture({ answeredAt, itemId: higher.item.id, userId: user.id }),
      attemptFixture({ answeredAt, itemId: lower.item.id, userId: user.id }),
    ]);

    await expect(pick()).resolves.toMatchObject([{ needsSet: true, setId: lower.set.id }, {}]);
  });

  it("voices a set whose voicing failed before writing another", async () => {
    const { goal, user } = await listeningGoalFixture();
    const exam = await loadExam(goal.id);
    const { set } = await partSet({ exam, voiced: false });

    const [pick] = await pickListeningSets({
      examBlueprintId: exam.blueprintId,
      parts: exam.parts,
      scriptLanguage: "en",
      userId: user.id,
    });

    expect(pick).toMatchObject({ needsSet: true, setId: null });
    await expect(findUnvoicedPartSet({ exam, part: firstPart(exam) })).resolves.toBe(set.id);
  });
});

describe(writePartSet, () => {
  it("writes nothing more for a part at its most sets", async () => {
    const { goal } = await listeningGoalFixture();
    const exam = await loadExam(goal.id);

    await Promise.all(Array.from({ length: MAX_SETS_PER_PART }, () => partSet({ exam })));

    await expect(writePartSet({ exam, part: firstPart(exam) })).resolves.toBeNull();
    expect(writeListeningSet).not.toHaveBeenCalled();
  });

  it("writes the part's next set on the exam's listening skills", async () => {
    const { goal, listeningSkills } = await listeningGoalFixture();
    const exam = await loadExam(goal.id);
    const part = firstPart(exam);
    const { provenance } = mockWrittenListeningSet();

    const setId = await writePartSet({ exam, part });

    expect(writeListeningSet).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        count: part.count,
        exam: exam.name,
        language: "pt",
        plays: part.plays,
        scriptLanguage: "en",
        skills: listeningSkills.map((skill) => ({
          description: skill.description,
          name: skill.name,
          skillId: skill.id,
        })),
        task: part.task,
      }),
    );

    await expect(
      prisma.itemSet.findUniqueOrThrow({ where: { id: setId ?? "" } }),
    ).resolves.toMatchObject({ examBlueprintId: exam.blueprintId, runId: provenance.runId });
  });
});
