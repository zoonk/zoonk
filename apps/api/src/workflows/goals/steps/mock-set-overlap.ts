import { type CallWait } from "@zoonk/ai/provider-options";
import { getWrittenSetStimulus } from "@zoonk/core/library/items/check-set-keys";
import { type ItemSetToStore, type WrittenSetItem } from "@zoonk/core/library/items/create-set";
import { toContentAnalytics } from "../../_shared/content-analytics";
import { checkMockOverlapStep } from "./check-mock-overlap-step";
import { loadMockWritingSkillsStep } from "./mock-question-steps";

async function getSetStimulusStep(set: Pick<ItemSetToStore, "content" | "kind">) {
  "use step";
  return getWrittenSetStimulus(set);
}

export async function screenMockSet({
  goalId,
  set,
  wait,
  workflowRunId,
}: {
  goalId: string;
  set: ItemSetToStore<WrittenSetItem>;
  wait: CallWait;
  workflowRunId: string;
}): Promise<ItemSetToStore<WrittenSetItem>> {
  const bySkill = Map.groupBy(set.items, (question) => question.skillId);

  const [skills, stimulus] = await Promise.all([
    loadMockWritingSkillsStep({ goalId, skillIds: [...bySkill.keys()] }),
    getSetStimulusStep({ content: set.content, kind: set.kind }),
  ]);

  const groups = await Promise.all(
    skills.map(async (mock) => {
      const items = (bySkill.get(mock.id) ?? []).map((question) => question.item);

      const kept = await checkMockOverlapStep({
        analytics: toContentAnalytics({ scope: mock, workflowRunId }),
        items,
        mock,
        stimulus,
        wait,
      });

      return [mock.id, new Set(kept.map((item) => JSON.stringify(item)))] as const;
    }),
  );

  const accepted = new Map(groups);

  return {
    ...set,
    items: set.items.filter(({ item, skillId }) =>
      accepted.get(skillId)?.delete(JSON.stringify(item)),
    ),
    mockOnly: true,
  };
}
