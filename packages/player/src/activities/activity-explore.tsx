"use client";

import { getActivityExpected } from "@zoonk/core/library/activities/expected";
import {
  type ActivityStepContent,
  type ExploreActivityContent,
  exploresSolved,
} from "@zoonk/core/library/activities/templates";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { Suspense } from "react";
import { ActivityCanvasSkeleton } from "./_components/activity-canvas";
import { ActivityDataNote } from "./_components/activity-data-note";
import { activityRenderers } from "./activity-registry";

function toCanvasContent(content: ExploreActivityContent): ActivityStepContent {
  return { ...content, check: { kind: "choice", options: [], question: "" }, prompt: "" };
}

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
