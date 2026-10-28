import { type CallWait } from "@zoonk/ai/provider-options";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  listListeningPartsToPrepareStep,
  preparePartSetStep,
  voiceListeningSetStep,
} from "./steps/listening-sets-steps";

export type ListeningSetsInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  /** From the learner's session, never the client. */
  userId?: string;
  wait: CallWait;
};

export type ListeningSetsResult = { status: "joined" | "none" | "prepared"; voiced: number };

export async function listeningSetsWorkflow(
  input: ListeningSetsInput,
): Promise<ListeningSetsResult> {
  "use workflow";

  const { analytics, goalId, userId, wait } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `listening-sets:${goalId}` });

  if (await hook.getConflict()) {
    return { status: "joined", voiced: 0 };
  }

  const unready = await listListeningPartsToPrepareStep({ goalId, userId });

  if (!unready || unready.parts.length === 0) {
    return { status: "none", voiced: 0 };
  }

  const context = { analytics, wait, workflowRunId };

  const voiced = await Promise.allSettled(
    unready.parts.map(async (part) => {
      const setId = await preparePartSetStep({ ...context, exam: unready.exam, part });
      return setId ? voiceListeningSetStep({ ...context, setId }) : false;
    }),
  );

  return {
    status: "prepared",
    voiced: voiced.filter((result) => result.status === "fulfilled" && result.value).length,
  };
}
