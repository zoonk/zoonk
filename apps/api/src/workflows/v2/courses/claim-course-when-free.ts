import { repeatUntil } from "../_shared/repeat-until";
import { claimCourseOutlineStep } from "./steps/course-outline-steps";

/**
 * `waited` says the course may have changed since the caller planned its bands. Workflow code only:
 * `wait` sleeps between tries.
 */
export async function claimCourseWhenFree({
  courseId,
  tries,
  wait,
  workflowRunId,
}: {
  courseId: string;
  tries: number;
  wait: () => Promise<unknown>;
  workflowRunId: string;
}): Promise<{ claimed: boolean; waited: boolean }> {
  const first = await claimCourseOutlineStep({ courseId, workflowRunId });

  if (first === "claimed") {
    return { claimed: true, waited: false };
  }

  const claim = await repeatUntil({
    done: (result) => result === "claimed",
    run: async () => {
      await wait();
      return claimCourseOutlineStep({ courseId, workflowRunId });
    },
    times: tries,
  });

  return { claimed: claim === "claimed", waited: true };
}
