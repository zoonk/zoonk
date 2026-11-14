import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { pickListeningSets } from "../../exams/listening/pick-listening-sets";
import { listItemSetsForSkills } from "../../library/items/item-sets";
import {
  approve,
  proposeFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";

async function apply(changes: object[]) {
  await signInProposer();
  const fix = await proposeFix({ changes, reason: "Probe." });
  const { key } = await signInApprover();
  const decided = await approve({ fixId: fix.id, key });
  return { decided, fix };
}

describe("listening set corrections", () => {
  it("picks the replacement listening set for a new mock", async () => {
    const user = await userFixture();
    const blueprint = await examBlueprintFixture({ language: "en" });
    const skill = await skillFixture();
    const recording = await mediaAssetFixture();
    const content = listeningContent();

    const set = await listeningSetFixture({
      content,
      examBlueprintId: blueprint.id,
      mediaAssetId: recording.id,
    });

    const item = await itemFixture({
      content: choiceItemContent("What day does Tom book?"),
      examBlueprintId: blueprint.id,
      setId: set.id,
      setPosition: 0,
      skillId: skill.id,
    });

    const part = { count: 1, plays: 1 as const, sectionName: "Listening", task: content.task };

    const { decided, fix } = await apply([
      {
        id: set.id,
        model: "ItemSet",
        replace: {
          content,
          questions: [
            { content: choiceItemContent("Which day does Tom finally book?"), id: item.id },
          ],
        },
      },
    ]);

    const change = fix.changes[0];
    const replacementId = change && "replacementId" in change ? change.replacementId : null;

    const [picked] = await pickListeningSets({
      examBlueprintId: blueprint.id,
      parts: [part],
      scriptLanguage: "en",
      userId: user.id,
    });

    const listed = await listItemSetsForSkills({
      examBlueprintId: blueprint.id,
      skillIds: [skill.id],
      userId: user.id,
    });

    expect({
      decided: "fix" in decided ? decided.fix?.status : decided.status,
      listed: listed.map((entry) => ({
        items: entry.items.length,
        which: entry.id === set.id ? "old" : "replacement",
      })),
      picked: picked?.setId,
    }).toStrictEqual({
      decided: "applied",
      listed: [{ items: 1, which: "replacement" }],
      picked: replacementId,
    });
  });
});
