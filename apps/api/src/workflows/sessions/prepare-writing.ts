import { listWritingPreparation } from "@zoonk/core/lookahead/writing-preparation";
import { startAll } from "../goals/goal-outlines";
import { ensureWritingPrompts } from "./writing-prompt-workflow";

type SessionWritingInput = Parameters<typeof listWritingPreparation>[0];

async function listWritingPreparationStep(input: SessionWritingInput) {
  "use step";

  return listWritingPreparation(input);
}

export async function prepareWriting(input: SessionWritingInput) {
  const requests = await listWritingPreparationStep(input);
  await startAll(requests.map((request) => ensureWritingPrompts(request)));
}
