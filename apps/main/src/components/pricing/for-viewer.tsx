import { type ReactNode } from "react";
import { type PlusViewerState } from "./plus-plan";
import { PlanNextStepVersion, ViewerVersion, type ViewerVersions } from "./viewer-version";

type RenderForViewer = (viewerState: PlusViewerState) => ReactNode;

/** `render`'s version for every reader, for the browser to show the reader's. */
function renderEveryVersion(render: RenderForViewer): ViewerVersions {
  return {
    free: render({ status: "free" }),
    guest: render({ status: "guest" }),
    subscribed: render({ status: "subscribed" }),
    visitor: render({ status: "visitor" }),
  };
}

/**
 * What `render` shows whoever is reading: the reader the server knows (`viewerState`, the
 * subscription page), or on the static pricing page every reader's version, of which the browser
 * shows the reader's (`ViewerVersion`).
 */
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

/**
 * A plan card's next step (`render`: its action and the line under it) for whoever is reading, as
 * `ForViewer` picks it. The static page's versions share the visitor's room
 * (`PlanNextStepVersion`), so the card doesn't move when the reader's arrives.
 */
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
