import { admitWritingPromptWork } from "../../../library/items/_utils/writing-prompt-spend";
import { getWritingPromptId, writeWritingItem } from "../../../library/items/write-writing-item";
import {
  type WritingSupplyInput,
  loadWritingSupply,
} from "../../../library/items/writing-prompt-pool";

export async function writingPromptRunFixture(input: WritingSupplyInput) {
  const runId = crypto.randomUUID();
  const itemId = getWritingPromptId(runId, 0);
  const supply = await loadWritingSupply(input);

  const poolToken = supply?.poolToken;
  const result = poolToken && (await admitWritingPromptWork({ input, poolToken, runId }));

  if (result && result.status === "signUpRequired") {
    throw new Error("Expected the writing prompt run to be admitted.");
  }

  return {
    itemId,
    write: async () => {
      if (poolToken && result && result.status === "writing") {
        await writeWritingItem({ input, poolToken, runId, slot: 0 });
      }
    },
  };
}
