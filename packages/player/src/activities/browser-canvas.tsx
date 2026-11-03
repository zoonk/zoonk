"use client";

import { Suspense, use } from "react";
import { browser } from "react-dom";
import { ActivityCanvasSkeleton } from "./_components/activity-canvas";
import { activityRenderers } from "./activity-registry";
import { type AnyActivityRendererProps } from "./activity-renderer";

function CanvasInBrowser(props: AnyActivityRendererProps) {
  use(browser());
  const { Canvas } = activityRenderers[props.content.template];
  return <Canvas {...props} />;
}

export function BrowserCanvas(props: AnyActivityRendererProps) {
  return (
    <Suspense fallback={<ActivityCanvasSkeleton />}>
      <CanvasInBrowser {...props} />
    </Suspense>
  );
}
