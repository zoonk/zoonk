"use client";

import { getExploreExpected } from "@zoonk/core/library/activities/expected";
import {
  type ActivityStepContent,
  type ExploreActivityContent,
} from "@zoonk/core/library/activities/templates";
import { ActivityDataNote } from "./_components/activity-data-note";
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
  return (
    <div className="flex w-full flex-col gap-2" data-slot="activity-explore">
      <BrowserCanvas
        answer={null}
        content={toCanvasContent(content)}
        expected={getExploreExpected(content)}
        labelId={labelId}
        onAnswerChange={noAnswer}
        phase="explore"
      />

      <ActivityDataNote content={content} />
    </div>
  );
}
