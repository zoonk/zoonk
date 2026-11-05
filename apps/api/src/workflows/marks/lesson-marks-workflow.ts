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

const WAIT_INTERVAL = "10s";
/** Past the claim's stale window in core (`claimLessonIcon`), so a dead run's icon can be retaken. */
const MAX_WAITS = 66;

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

function drawAll({
  analytics,
  icons,
  runId,
}: {
  analytics: IconContext;
  icons: readonly PickedIcon[];
  runId: string;
}): Promise<boolean[]> {
  return Promise.all(
    icons
      .filter((icon) => icon.state === "draw")
      .map((icon) => drawIcon({ analytics, icon, runId })),
  );
}

/** The icons another run still draws when the wait ends. */
async function waitForOtherRuns(icons: readonly PickedIcon[]): Promise<PickedIcon[]> {
  if (icons.length === 0) {
    return [];
  }

  const states = await repeatUntil({
    done: (current) => current.every((icon) => icon.status !== "running"),
    run: async () => {
      await sleep(WAIT_INTERVAL);
      return readIconStatesStep(icons.map((icon) => icon.iconId));
    },
    times: MAX_WAITS,
  });

  const running = new Set(states.flatMap((icon) => (icon.status === "running" ? [icon.id] : [])));
  return icons.filter((icon) => running.has(icon.iconId));
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

  const [drawn, stalled] = await Promise.all([
    drawAll({ analytics: context, icons: picked, runId: workflowRunId }),
    waitForOtherRuns(picked.filter((icon) => icon.state === "wait")),
  ]);

  const stalledNames = new Set(stalled.map((icon) => icon.name));

  const retaken =
    stalled.length > 0
      ? await pickIcons({
          analytics: context,
          lessonId,
          requests: tagged.requests.filter((request) => stalledNames.has(request.need.name)),
          runId: workflowRunId,
          wait,
        })
      : [];

  const redrawn = await drawAll({ analytics: context, icons: retaken, runId: workflowRunId });
  const settled = [...picked.filter((icon) => !stalledNames.has(icon.name)), ...retaken];
  const outcomes = [...drawn, ...redrawn];

  await linkLessonIconsStep({ lessonId, picked: settled });

  return {
    drawn: outcomes.filter(Boolean).length,
    failed: outcomes.filter((ok) => !ok).length,
    icons: settled.length,
  };
}
