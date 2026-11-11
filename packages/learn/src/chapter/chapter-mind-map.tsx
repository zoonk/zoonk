"use client";

import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { createContext, use } from "react";
import { useServedState } from "../_utils/use-served-state";
import { type MindMapActions } from "../mind-maps/mind-map-actions";
import { MindMapAside } from "../mind-maps/mind-map-aside";
import { MindMapRowView } from "../mind-maps/mind-map-row";
import { type MindMapRequest, useMindMapRequest } from "../mind-maps/use-mind-map-request";

export type ChapterMindMap = { actions: MindMapActions; plus: boolean; view: ChapterMindMapView };

type ChapterMap = { plus: boolean; request: MindMapRequest; view: ChapterMindMapView };

/**
 * The page's sidebar sits beside it from this width (`PageWithAside`). Narrower, the sidebar falls
 * below the lessons, so the map moves up under the header, where it's seen first.
 */
const NARROW_ONLY_CLASS = "min-[72rem]:hidden";
export const WIDE_ONLY_CLASS = "hidden min-[72rem]:flex";

const ChapterMapContext = createContext<ChapterMap | null>(null);

function ChapterMapState({
  children,
  mindMap,
}: {
  children: React.ReactNode;
  mindMap: ChapterMindMap;
}) {
  const [view, setView] = useServedState(mindMap.view);
  const request = useMindMapRequest({ actions: mindMap.actions, onViewChange: setView, view });

  return (
    <ChapterMapContext value={{ plus: mindMap.plus, request, view }}>{children}</ChapterMapContext>
  );
}

/** One request for the map, so its row and its sidebar card say the same thing and poll once. */
export function ChapterMapProvider({
  children,
  mindMap,
}: {
  children: React.ReactNode;
  mindMap: ChapterMindMap | null;
}) {
  return mindMap ? <ChapterMapState mindMap={mindMap}>{children}</ChapterMapState> : children;
}

function useShownMap(): ChapterMap | null {
  const map = use(ChapterMapContext);
  return map && map.request.shown !== "unavailable" ? map : null;
}

/** Whether the sidebar has the map to show, on the screens wide enough to show it there. */
export function useHasAsideMap(): boolean {
  return useShownMap() !== null;
}

/** Under the header on narrow screens. */
export function ChapterMapRow() {
  const map = useShownMap();

  if (!map) {
    return null;
  }

  return (
    <MindMapRowView
      className={NARROW_ONLY_CLASS}
      place="chapter"
      plus={map.plus}
      request={map.request}
      view={map.view}
    />
  );
}

/** In the sidebar's "For reference" on wide screens, with the picture itself. */
export function ChapterMapAside() {
  const map = useShownMap();

  if (!map) {
    return null;
  }

  return (
    <div className={`${WIDE_ONLY_CLASS} flex-col`} data-slot="chapter-map-aside">
      <MindMapAside plus={map.plus} request={map.request} view={map.view} />
    </div>
  );
}
