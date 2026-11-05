import { type CallWait } from "@zoonk/ai/provider-options";
import { type PickedIcon } from "@zoonk/core/library/marks/icons";
import { getWorkflowMetadata, sleep } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { waitForRunToken } from "../_shared/run-token";
import {
  drawLessonIconStep,
  failLessonIconStep,
  linkLessonIconsStep,
  pickLessonIconsStep,
  readIconStatesStep,
  tagLessonMarksStep,
} from "./steps/lesson-marks-steps";

export type LessonMarksInput = { analytics?: ContentAnalytics; lessonId: string; wait?: CallWait };

export type LessonMarksResult = { drawn: number; failed: number; icons: number };

const WAIT_INTERVAL = "5s";
const MAX_WAITS = 36;

type IconContext = {
  contentScope: "personal" | "shared";
  distinctId?: string;
  goalId?: string;
  traceId: string;
};

async function drawIcon({
  analytics,
  icon,
  runId,
}: {
  analytics: IconContext;
  icon: PickedIcon;
  runId: string;
}): Promise<boolean> {
  try {
    return (await drawLessonIconStep({ analytics, iconId: icon.iconId, runId })) === "completed";
  } catch {
    await failLessonIconStep({ iconId: icon.iconId, runId });
    return false;
  }
}

async function waitForOtherRuns(icons: readonly PickedIcon[]): Promise<void> {
  const iconIds = icons.map((icon) => icon.iconId);

  if (iconIds.length === 0) {
    return;
  }

  await repeatUntil({
    done: (states) => !states.includes("running"),
    run: async () => {
      await sleep(WAIT_INTERVAL);
      return readIconStatesStep(iconIds);
    },
    times: MAX_WAITS,
  });
}

async function pickIcons({
  analytics,
  lessonId,
  ...input
}: Parameters<typeof pickLessonIconsStep>[0] & { lessonId: string }): Promise<PickedIcon[]> {
  try {
    return await pickLessonIconsStep({ analytics, ...input });
  } catch (error) {
    await linkLessonIconsStep({ lessonId, picked: [] });
    throw error;
  }
}

export async function lessonMarksWorkflow({
  analytics,
  lessonId,
  wait,
}: LessonMarksInput): Promise<LessonMarksResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const learner = { distinctId: analytics?.distinctId, goalId: analytics?.goalId };
  await waitForRunToken(`lesson-marks:${lessonId}`);

  const tagged = await tagLessonMarksStep({
    analytics: { ...learner, traceId: workflowRunId },
    lessonId,
    wait,
  });

  if (!tagged || tagged.requests.length === 0) {
    return { drawn: 0, failed: 0, icons: 0 };
  }

  const context = { ...learner, contentScope: tagged.contentScope, traceId: workflowRunId };

  const picked = await pickIcons({
    analytics: context,
    lessonId,
    requests: tagged.requests,
    runId: workflowRunId,
    wait,
  });

  const [drawn] = await Promise.all([
    Promise.all(
      picked
        .filter((icon) => icon.state === "draw")
        .map((icon) => drawIcon({ analytics: context, icon, runId: workflowRunId })),
    ),
    waitForOtherRuns(picked.filter((icon) => icon.state === "wait")),
  ]);

  await linkLessonIconsStep({ lessonId, picked });

  return {
    drawn: drawn.filter(Boolean).length,
    failed: drawn.filter((ok) => !ok).length,
    icons: picked.length,
  };
}
