import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  findListeningRecording,
  prepareListeningRecording,
  publishListeningRecording,
  storeListeningPart,
} from "@zoonk/core/library/listening/voice";
import { getStepMetadata } from "workflow";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import { acquireRunToken } from "../_shared/run-token";

type RecordingInput = {
  analytics?: ContentAnalytics;
  setId: string;
  wait: CallWait;
  workflowRunId: string;
};

async function findRecordingStep(setId: string) {
  "use step";

  return findListeningRecording(setId);
}

async function prepareRecordingStep(setId: string) {
  "use step";

  return prepareListeningRecording(setId);
}

type SegmentInput = Pick<
  Parameters<typeof storeListeningPart>[0],
  "reuseKey" | "language" | "part" | "index"
>;

async function voiceSegmentStep(
  segment: SegmentInput,
  { analytics, wait, workflowRunId }: Omit<RecordingInput, "setId">,
) {
  "use step";

  await storeListeningPart({
    ...segment,
    analytics: toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId }),
    attempt: getStepMetadata().attempt,
    serviceTier: chooseServiceTier({ wait }),
  });
}

async function publishRecordingStep(setId: string, reuseKey: string) {
  "use step";

  return publishListeningRecording({ reuseKey, setId });
}

export async function voiceListeningRecording({
  setId,
  ...context
}: RecordingInput): Promise<boolean> {
  const found = await findRecordingStep(setId);

  if (found.status !== "unvoiced") {
    return found.status === "ready";
  }

  using claim = await acquireRunToken(found.reuseKey);
  const recording = await prepareRecordingStep(setId);

  if (recording.status !== "unvoiced") {
    return recording.status === "ready";
  }

  if (claim.conflict || recording.reuseKey !== found.reuseKey) {
    return false;
  }

  const { language, parts, reuseKey } = recording;

  const voiced = await Promise.allSettled(
    parts.map((part, index) => voiceSegmentStep({ index, language, part, reuseKey }, context)),
  );

  if (voiced.some((segment) => segment.status === "rejected")) {
    return false;
  }

  return await publishRecordingStep(setId, reuseKey);
}
