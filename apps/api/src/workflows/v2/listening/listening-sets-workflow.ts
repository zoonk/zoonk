import { type CallWait } from "@zoonk/ai/provider-options";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  listListeningPartsToPrepareStep,
  preparePartSetStep,
  voiceListeningSetStep,
} from "./steps/listening-sets-steps";

export type ListeningSetsInput = {
  /** The learner whose goal started it, for analytics; the recordings are shared. */
  analytics?: ContentAnalytics;
  goalId: string;
  /**
   * The learner whose next practice needs a new recording (from their session, never the client),
   * so parts where they heard every set get one too; unset for the goal's setup.
   */
  userId?: string;
  wait: CallWait;
};

export type ListeningSetsResult = { status: "joined" | "none" | "prepared"; voiced: number };

/**
 * Makes a recording ready for each part of the goal's exam that needs one
 * (`listListeningPartsToPrepare`): a listening set written for the part (its script and the
 * questions on it, shared by every learner of the exam) and its voicing, every part at once.
 * Started with the goal's content at the flex tier, so the first learner of an exam pays for one
 * recording per part and every later one finds them made, and when a learner's session starts
 * and they heard every recording of a part. One run per goal: a second start joins it.
 */
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
