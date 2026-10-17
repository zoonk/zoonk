import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { ITEM_SET_INCLUDE, listItemSetsForSkills, toItemSetView } from "./item-sets";

/** A set's questions, in the order given, on the given skills. */
async function setItems({ setId, skillIds }: { setId: string; skillIds: string[] }) {
  return Promise.all(
    skillIds.map((skillId, setPosition) =>
      itemFixture({ content: choiceItemContent(), setId, setPosition, skillId }),
    ),
  );
}

describe(listItemSetsForSkills, () => {
  it("lists whole sets on the skills, never answered first, without another exam's or a silent recording", async () => {
    const [user, reading, inference, other, blueprint, otherExam] = await Promise.all([
      userFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
      examBlueprintFixture(),
      examBlueprintFixture(),
    ]);

    // Written one after another: sets never answered come in the order they were written.
    const answered = await itemSetFixture();
    const fresh = await itemSetFixture();
    const exams = await itemSetFixture({ examBlueprintId: blueprint.id });

    const [otherExams, silent] = await Promise.all([
      itemSetFixture({ examBlueprintId: otherExam.id }),
      listeningSetFixture(),
    ]);

    const [answeredItems, freshItems, examItems] = await Promise.all([
      setItems({ setId: answered.id, skillIds: [reading.id, inference.id] }),
      setItems({ setId: fresh.id, skillIds: [inference.id, other.id, reading.id] }),
      setItems({ setId: exams.id, skillIds: [reading.id] }),
      setItems({ setId: otherExams.id, skillIds: [reading.id] }),
      setItems({ setId: silent.id, skillIds: [reading.id] }),
      // A question on its own isn't a set.
      itemFixture({ content: choiceItemContent(), skillId: reading.id }),
    ]);

    await attemptFixture({ itemId: answeredItems[1]?.id, skillId: inference.id, userId: user.id });

    const sets = await listItemSetsForSkills({
      examBlueprintId: blueprint.id,
      skillIds: [reading.id],
      userId: user.id,
    });

    expect(
      sets.map((set) => [set.id, set.items.map((item) => item.id), set.lastAnsweredAt !== null]),
    ).toStrictEqual([
      [fresh.id, freshItems.map((item) => item.id), false],
      [exams.id, examItems.map((item) => item.id), false],
      [answered.id, answeredItems.map((item) => item.id), true],
    ]);

    expect(sets[0]?.skillIds).toStrictEqual([inference.id, other.id, reading.id]);
  });
});

describe(toItemSetView, () => {
  it("shows a question's passage with its place in the set, and a recording's file but never its script", async () => {
    const skill = await skillFixture();
    const passage = textSetContent("The Sunday library");

    const [text, recording, asset] = await Promise.all([
      itemSetFixture({ content: passage }),
      listeningSetFixture(),
      prisma.mediaAsset.create({
        data: {
          durationMs: 42_000,
          kind: "audio",
          model: "test",
          promptVersion: "test",
          reuseKey: `test-${crypto.randomUUID()}`,
          runId: "test",
          url: "https://example.com/recording.mp3",
        },
      }),
    ]);

    await prisma.itemSet.update({ data: { mediaAssetId: asset.id }, where: { id: recording.id } });

    const [textItems, recordingItems] = await Promise.all([
      setItems({ setId: text.id, skillIds: [skill.id, skill.id] }),
      setItems({ setId: recording.id, skillIds: [skill.id] }),
    ]);

    const rows = await prisma.item.findMany({
      include: ITEM_SET_INCLUDE,
      where: { id: { in: [textItems[1]?.id ?? "", recordingItems[0]?.id ?? ""] } },
    });

    const view = (itemId: string | undefined, reveal = false) =>
      toItemSetView({
        item: rows.find((row) => row.id === itemId) ?? { set: null, setPosition: null },
        reveal,
      });

    expect(view(textItems[1]?.id)).toStrictEqual({
      count: 2,
      id: text.id,
      kind: "text",
      listening: null,
      position: 1,
      source: passage.source,
      text: passage.text,
      title: "The Sunday library",
      visual: null,
    });

    expect(view(recordingItems[0]?.id)).toMatchObject({
      count: 1,
      id: recording.id,
      kind: "audio",
      listening: {
        audio: { durationMs: 42_000, url: "https://example.com/recording.mp3" },
        plays: 1,
        transcript: null,
      },
      position: 0,
      text: null,
      title: "Booking a hall",
    });

    expect(JSON.stringify(view(recordingItems[0]?.id))).not.toContain("Riverside");
    expect(view(recordingItems[0]?.id, true)?.listening?.transcript).toHaveLength(4);
  });
});
