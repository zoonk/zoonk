"use client";

import { getExploreExpected } from "@zoonk/core/library/activities/expected";
import {
  type ActivityStepContent,
  type ExploreActivityContent,
} from "@zoonk/core/library/activities/templates";
import { ActivityBadge, isExploreBadge } from "./_components/activity-badge";
import { ActivityDataNote } from "./_components/activity-data-note";
import { activityRenderers } from "./activity-registry";
import { BrowserCanvas } from "./browser-canvas";

function toCanvasContent(content: ExploreActivityContent): ActivityStepContent {
  return { ...content, check: { kind: "choice", options: [], question: "" }, prompt: "" };
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
  const canvasContent = toCanvasContent(content);
  const badgeKind = activityRenderers[content.template].badge(canvasContent);

  return (
    <div className="flex w-full flex-col gap-2" data-slot="activity-explore">
      {/* The chip an activity carries as a question, so it's the same activity in every state. */}
      {badgeKind && isExploreBadge(badgeKind) && <ActivityBadge kind={badgeKind} />}

      <BrowserCanvas
        answer={null}
        content={canvasContent}
        expected={getExploreExpected(content)}
        labelId={labelId}
        onAnswerChange={noAnswer}
        phase="explore"
      />

      <ActivityDataNote content={content} />
    </div>
  );
}
