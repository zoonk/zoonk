import { listWritingPreparation } from "@zoonk/core/lookahead/writing-preparation";
import { waitForRun } from "../_shared/run-token";
import { ensureWritingPrompts } from "./writing-prompt-workflow";

type SessionWritingInput = Parameters<typeof listWritingPreparation>[0];

async function listWritingPreparationStep(input: SessionWritingInput) {
  "use step";

  return listWritingPreparation(input);
}

export async function prepareWriting(input: SessionWritingInput) {
  const requests = await listWritingPreparationStep(input);
  const groups = Map.groupBy(requests, (request) => request.taskKey);

  await Promise.all(
    [...groups.values()].map((group) =>
      group.reduce<Promise<void>>(async (prior, request, index) => {
        await prior;
        const result = await ensureWritingPrompts(request);

        if (result.status === "writing" && index < group.length - 1) {
          await waitForRun(result.runId);
        }
      }, Promise.resolve()),
    ),
  );
}
