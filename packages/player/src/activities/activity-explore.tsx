"use client";

import {
  type ActivityStepContent,
  type ExploreActivityContent,
  exploresSolved,
} from "@zoonk/core/library/activities/templates";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { Suspense } from "react";
import { ActivityCanvasSkeleton } from "./_components/activity-canvas";
import { ActivityDataNote } from "./_components/activity-data-note";
import { getActivityExpected } from "./_utils/activity-expected";
import { activityRenderers } from "./activity-registry";

/**
 * Renderers read the content an activity screen has, check included. Explored, nothing is asked:
 * a question without options puts each canvas in its free mode, where it never reports an answer.
 */
function toCanvasContent(content: ExploreActivityContent): ActivityStepContent {
  return { ...content, check: { kind: "choice", options: [], question: "" }, prompt: "" };
}

/** What a canvas that only answers shows explored: the end state code computes from the fields. */
function exploredEndState(content: ExploreActivityContent) {
  return exploresSolved(content.template)
    ? getActivityExpected({
        ...content,
        check: { explanation: "", kind: "interaction" },
        prompt: "",
      })
    : null;
}

function noAnswer() {
  return null;
}

/**
 * An activity template on an explanation screen, to explore: its canvas without a question or a
 * check, labelled by the screen's title, with the data note under it. Templates with a model to
 * move are played with freely; those whose canvas only answers show their solved state.
 *
 * ```tsx
 * <ActivityExplore content={content.explore} labelId={titleId} />
 * ```
 */
export function ActivityExplore({
  content,
  labelId,
}: {
  content: ExploreActivityContent;
  labelId: string;
}) {
  const isMounted = useIsMounted();
  const { Canvas } = activityRenderers[content.template];

  return (
    <div className="flex w-full flex-col gap-2" data-slot="activity-explore">
      {isMounted ? (
        <Suspense fallback={<ActivityCanvasSkeleton />}>
          <Canvas
            answer={null}
            content={toCanvasContent(content)}
            expected={exploredEndState(content)}
            labelId={labelId}
            onAnswerChange={noAnswer}
            phase="explore"
          />
        </Suspense>
      ) : (
        <ActivityCanvasSkeleton />
      )}

      <ActivityDataNote content={content} />
    </div>
  );
}
