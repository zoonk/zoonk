import {
  getOwedResearchUploadAnswer,
  getReadableResearchUploadIds,
  reopenResearchUploadAnswer,
} from "@zoonk/core/library/sources/research-upload-answer";
import { type ResearchUploadAnswerKey } from "@zoonk/core/library/sources/upload-request";
import { startOnce } from "../_shared/run-token";
import { endFollowUpStep } from "../follow-ups/steps/follow-up-steps";
import { type ResearchResult } from "./research-result";
import { researchWorkflow } from "./research-workflow";
import { waitForMaterialReading } from "./wait-for-material-reading";

async function loadAnswerStep(key: ResearchUploadAnswerKey) {
  "use step";

  return getOwedResearchUploadAnswer(key);
}

async function readAnswerSourcesStep(sourceIds: string[]) {
  "use step";

  return getReadableResearchUploadIds(sourceIds);
}

async function reopenAnswerStep(input: Parameters<typeof reopenResearchUploadAnswer>[0]) {
  "use step";

  await reopenResearchUploadAnswer(input);
}

export async function answerResearchUploadWorkflow(
  key: ResearchUploadAnswerKey,
): Promise<ResearchResult> {
  "use workflow";

  const answer = await loadAnswerStep(key);

  if (!answer) {
    return { status: "notNeeded" };
  }

  await waitForMaterialReading({ kind: "sources", sourceIds: answer.sourceIds }, "1s");
  const readable = await readAnswerSourcesStep(answer.sourceIds);

  if (readable.length === 0) {
    await reopenAnswerStep(answer);
    return { reason: answer.reason, status: "needsUpload" };
  }

  const result = await researchWorkflow({ goalId: answer.goalId, sourceIds: readable });
  await endFollowUpStep(answer);
  return result;
}

export function startResearchUploadAnswer(key: ResearchUploadAnswerKey): Promise<string> {
  return startOnce(answerResearchUploadWorkflow, [key], `research-upload-answer:${key.answerId}`);
}
