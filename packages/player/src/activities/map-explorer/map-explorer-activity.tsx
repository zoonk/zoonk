"use client";

import { getActivityBaseMap } from "@zoonk/core/library/activities/base-maps";
import { useFormatNumber } from "@zoonk/learn/format-number";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { MapPin as MapPinIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { use, useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { type BaseMapDrawing } from "../_assets/base-maps/base-map-drawing";
import { projectPlace } from "../_assets/base-maps/base-map-projection";
import { loadBaseMap } from "../_assets/base-maps/load-base-map";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { BaseMapView, type MapPin } from "./base-map-view";
import { fitViewport, spreadPins } from "./map-viewport";
import { useBaseMapLabels, useBaseMapName, useBaseMapNote } from "./use-base-map-words";

type MapExplorerProps = ActivityRendererProps<"mapExplorer">;
type Place = MapExplorerProps["content"]["fields"]["places"][number];

const FALLBACK_WIDTH = 318;
/** Pins keep this much room around them, in pixels, so each stays easy to tap. */
const PIN_SPACING = 40;
/** The tallest the map gets, in pixels, so a wide screen doesn't turn it into a wall. */
const MAX_MAP_HEIGHT = 440;

const LEGEND_CLASS: Record<string, string> = {
  groupA: "bg-viz-accent-soft",
  groupB: "bg-viz-highlight-soft",
  groupC: "bg-success/15",
};

function MapLegend({
  drawing,
  labelText,
}: {
  drawing: BaseMapDrawing;
  labelText: (key: string | null, text: string) => string;
}) {
  if (drawing.legend.length === 0) {
    return null;
  }

  return (
    <ul aria-hidden="true" className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {drawing.legend.map((item) => (
        <li className="flex items-center gap-1.5" key={item.key}>
          <span
            className={cn(
              "border-border size-3 rounded-sm border",
              LEGEND_CLASS[item.tone] ?? "bg-background",
            )}
          />
          {labelText(item.key, item.key)}
        </li>
      ))}
    </ul>
  );
}

function PlaceDetails({ number, place }: { number: number; place: Place | null }) {
  const t = useExtracted();

  if (!place) {
    return (
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <LineMarker>
          <MapPinIcon aria-hidden="true" className="size-4" />
        </LineMarker>
        {t("Tap a numbered place to see what's there.")}
      </p>
    );
  }

  return (
    <div className="bg-background flex gap-3 rounded-2xl border p-3" data-slot="map-place-details">
      <span className="bg-viz-accent text-background flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums">
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm leading-snug font-semibold">{place.label}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <LessonRichText text={place.reveals} />
        </p>
      </div>
    </div>
  );
}

/** Pins in pixels: each place projected with the map's own projection, then nudged apart. */
function layoutPins({
  drawing,
  places,
  selectedId,
  visited,
  width,
}: {
  drawing: BaseMapDrawing;
  places: readonly Place[];
  selectedId: string | null;
  visited: readonly string[];
  width: number;
}) {
  const projected = places.flatMap((place, index) => {
    const point = projectPlace(drawing.projection, place);
    return point ? [{ index, place, point }] : [];
  });

  const crop = fitViewport({
    map: drawing,
    maxAspect: MAX_MAP_HEIGHT / width,
    maxZoom: drawing.maxZoom,
    points: projected.map((item) => item.point),
  });

  const scale = width / crop.width;
  const height = Math.round(crop.height * scale);

  const spots = projected.map((item) => ({
    x: (item.point.x - crop.x) * scale,
    y: (item.point.y - crop.y) * scale,
  }));

  const shown = spreadPins({ distance: PIN_SPACING, frame: { height, width }, points: spots });

  const pins: MapPin[] = projected.map((item, index) => ({
    id: item.place.id,
    isSelected: item.place.id === selectedId,
    isVisited: visited.includes(item.place.id),
    label: item.place.label,
    number: item.index + 1,
    shown: shown[index] ?? { x: 0, y: 0 },
    spot: spots[index] ?? { x: 0, y: 0 },
  }));

  return { crop, height, pins };
}

function MapCanvas({
  content,
  drawing,
  labelId,
}: Pick<MapExplorerProps, "content" | "labelId"> & { drawing: BaseMapDrawing }) {
  const t = useExtracted();
  const format = useFormatNumber();
  const labelText = useBaseMapLabels();
  const mapName = useBaseMapName();
  const mapNote = useBaseMapNote();
  const { fields } = content;
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);

  const { crop, height, pins } = layoutPins({
    drawing,
    places: fields.places,
    selectedId,
    visited,
    width,
  });

  const selectedIndex = fields.places.findIndex((place) => place.id === selectedId);
  const baseMap = getActivityBaseMap(fields.baseMapId);
  const name = baseMap ? mapName(baseMap.id) : "";
  const note = baseMap ? mapNote(baseMap.id) : null;

  function select(id: string) {
    setSelectedId(id);
    setVisited((current) => (current.includes(id) ? current : [...current, id]));
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="flex items-baseline justify-between gap-3">
        <ActivityCanvasLabel className="text-sm">{name}</ActivityCanvasLabel>
        <ActivityCanvasLabel className="shrink-0 tabular-nums">
          {t("{count} of {total} explored", {
            count: format(visited.length),
            total: format(fields.places.length),
          })}
        </ActivityCanvasLabel>
      </div>

      <div ref={ref}>
        <BaseMapView
          crop={crop}
          drawing={drawing}
          height={height}
          labelText={labelText}
          onSelect={select}
          pins={pins}
          width={width}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <MapLegend drawing={drawing} labelText={labelText} />
        {note && <ActivityCanvasLabel>{note}</ActivityCanvasLabel>}
      </div>

      <div aria-live="polite">
        <PlaceDetails number={selectedIndex + 1} place={fields.places[selectedIndex] ?? null} />
      </div>

      <ActivityTextAlternative>
        {t("{map} with {count} places to explore: {places}.", {
          count: format(fields.places.length),
          map: name,
          places: fields.places.map((place, index) => `${index + 1}. ${place.label}`).join(", "),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

function MapUnavailable({ labelId }: { labelId: string }) {
  const t = useExtracted();

  return (
    <ActivityCanvas labelId={labelId}>
      <p className="text-muted-foreground text-sm">
        {t("This map can't be shown. Continue to the next screen.")}
      </p>
    </ActivityCanvas>
  );
}

/**
 * Tap places on a map to uncover evidence, like John Snow's cholera map. The base map comes from
 * the checked library (loaded only when shown) and each place is projected onto it with the same
 * projection its shapes were drawn with. The canvas zooms to the places; the check question is
 * about what the learner found.
 */
export function MapExplorerActivity({ content, labelId }: MapExplorerProps) {
  const drawing = use(loadBaseMap(content.fields.baseMapId));

  return drawing ? (
    <MapCanvas content={content} drawing={drawing} labelId={labelId} />
  ) : (
    <MapUnavailable labelId={labelId} />
  );
}
