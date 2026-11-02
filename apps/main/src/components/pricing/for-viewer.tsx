import { type ReactNode } from "react";
import { type PlusViewerState } from "./plus-plan";
import { PlanNextStepVersion, ViewerVersion, type ViewerVersions } from "./viewer-version";

type RenderForViewer = (viewerState: PlusViewerState) => ReactNode;

function renderEveryVersion(render: RenderForViewer): ViewerVersions {
  return {
    free: render({ status: "free" }),
    guest: render({ status: "guest" }),
    subscribed: render({ status: "subscribed" }),
    visitor: render({ status: "visitor" }),
  };
}

export function ForViewer({
  render,
  viewerState,
}: {
  render: RenderForViewer;
  viewerState?: PlusViewerState;
}) {
  if (viewerState) {
    return render(viewerState);
  }

  return <ViewerVersion versions={renderEveryVersion(render)} />;
}

export function PlanNextStep({
  render,
  viewerState,
}: {
  render: RenderForViewer;
  viewerState?: PlusViewerState;
}) {
  if (viewerState) {
    return <div className="mt-5 flex flex-col gap-2.5">{render(viewerState)}</div>;
  }

  return <PlanNextStepVersion versions={renderEveryVersion(render)} />;
}
