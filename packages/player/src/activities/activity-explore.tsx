"use client";

import { getExploreExpected } from "@zoonk/core/library/activities/expected";
import {
  type ActivityStepContent,
  type ExploreActivityContent,
} from "@zoonk/core/library/activities/templates";
import { type ActivityBadgeKind, isExploreBadge } from "./_components/activity-badge";
import { ActivityDataNote } from "./_components/activity-data-note";
import { activityRenderers } from "./activity-registry";
import { BrowserCanvas } from "./browser-canvas";

function toCanvasContent(content: ExploreActivityContent): ActivityStepContent {
  return { ...content, check: { kind: "choice", options: [], question: "" }, prompt: "" };
}

function noAnswer() {
  return null;
}

/** The chip an activity carries as a question, for the screen that explores it to show over its heading. */
export function exploreBadge(content: ExploreActivityContent): ActivityBadgeKind | null {
  const kind = activityRenderers[content.template].badge(toCanvasContent(content));
  return kind && isExploreBadge(kind) ? kind : null;
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
      {/* The panel's tint is see-through, so on a reading screen's dotted paper it gets a plain ground. */}
      <div className="bg-background rounded-xl">
        <BrowserCanvas
          answer={null}
          content={toCanvasContent(content)}
          expected={getExploreExpected(content)}
          labelId={labelId}
          onAnswerChange={noAnswer}
          phase="explore"
        />
      </div>

      <ActivityDataNote content={content} />
    </div>
  );
}
