"use client";

import { type DiagramId, isDiagramId } from "@zoonk/core/library/activities/diagrams";
import { seededShuffle } from "@zoonk/utils/seeded-random";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { diagramDrawings } from "../_assets/diagrams/diagram-drawings";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivityDragDrop } from "../_components/activity-drag-drop";
import { type ActivityRendererProps } from "../activity-renderer";
import { type PartMark } from "./diagram-art";
import { DiagramFigure, type PinState } from "./diagram-figure";
import { DiagramLegend } from "./diagram-legend";
import { DiagramSlots } from "./diagram-slots";
import {
  type DiagramSlot,
  type Placements,
  assignmentAnswer,
  mixUpFeedback,
  nextEmptySlot,
  orderSlots,
  placeName,
  removeName,
  unplacedNames,
} from "./labeled-diagram-model";
import { NameBank } from "./name-bank";
import { useDiagramTitle } from "./use-diagram-words";

type LabeledDiagramProps = ActivityRendererProps<"labeledDiagram">;
type Fields = LabeledDiagramProps["content"]["fields"];

function pinStateOf({
  isActive,
  isChecked,
  name,
  slot,
}: {
  isActive: boolean;
  isChecked: boolean;
  name: string | undefined;
  slot: DiagramSlot;
}): PinState {
  if (isChecked) {
    return name === slot.label ? "correct" : "incorrect";
  }

  if (isActive) {
    return "active";
  }

  return name ? "filled" : "empty";
}

function initialPlacements(answer: LabeledDiagramProps["answer"]): Placements {
  return answer?.kind === "assignment" ? answer.pairs : {};
}

function DiagramBoard({
  answer,
  fields,
  isChecked,
  labelId,
  onAnswerChange,
}: {
  answer: LabeledDiagramProps["answer"];
  fields: Fields & { diagramId: DiagramId };
  isChecked: boolean;
  labelId: string;
  onAnswerChange: LabeledDiagramProps["onAnswerChange"];
}) {
  const t = useExtracted();
  const drawing = diagramDrawings[fields.diagramId];
  const title = useDiagramTitle(fields.diagramId);
  const slots = orderSlots({ drawing, parts: fields.parts });
  const [placements, setPlacements] = useState(() => initialPlacements(answer));

  const [activePartId, setActivePartId] = useState(() =>
    nextEmptySlot({ after: null, placements, slots }),
  );

  const [announcement, setAnnouncement] = useState("");

  const names = seededShuffle(
    [...fields.parts.map((part) => part.label), ...fields.distractors],
    `${fields.diagramId}:${fields.parts.map((part) => part.partId).join(",")}`,
  );

  const activeSlot = isChecked ? undefined : slots.find((slot) => slot.partId === activePartId);

  function update(next: Placements, after: string | null) {
    setPlacements(next);
    setActivePartId(nextEmptySlot({ after, placements: next, slots }));
    onAnswerChange(assignmentAnswer(slots, next));
  }

  function place(name: string, partId: string) {
    const slot = slots.find((item) => item.partId === partId);
    update(placeName({ name, partId, placements }), partId);
    setAnnouncement(t("{name} on spot {number}.", { name, number: String(slot?.number ?? "") }));
  }

  function select(partId: string) {
    const name = placements[partId];

    if (!name) {
      setActivePartId(partId);
      return;
    }

    const next = removeName(placements, partId);
    setPlacements(next);
    setActivePartId(partId);
    onAnswerChange(assignmentAnswer(slots, next));
    setAnnouncement(t("{name} taken off.", { name }));
  }

  const pinStates = new Map(
    slots.map((slot) => [
      slot.partId,
      pinStateOf({ isActive: activeSlot === slot, isChecked, name: placements[slot.partId], slot }),
    ]),
  );

  const marks = new Map<string, PartMark>(
    [...pinStates].flatMap(([partId, state]) =>
      state === "active" || state === "correct" || state === "incorrect" ? [[partId, state]] : [],
    ),
  );

  const checked = isChecked
    ? new Map(
        slots.map((slot) => [
          slot.partId,
          mixUpFeedback({
            correct: slot.label,
            mixUps: fields.mixUps,
            placed: placements[slot.partId],
          }),
        ]),
      )
    : null;

  return (
    <ActivityDragDrop
      onDrop={(name, target) => {
        if (!isChecked) {
          place(name, target.replace(/^(?:pin|slot):/u, ""));
        }
      }}
    >
      <ActivityCanvas className="gap-4" labelId={labelId}>
        {/* The names sit right under the drawing, so picking a name never means scrolling away
            from the highlighted spot; on wider screens the spots list moves beside them. */}
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:grid-rows-[auto_1fr] sm:items-start sm:gap-x-6">
          <div className="flex flex-col gap-2 sm:col-start-1 sm:row-start-1">
            <DiagramFigure drawing={drawing} marks={marks} pinStates={pinStates} slots={slots} />
            {drawing.legend && <DiagramLegend items={drawing.legend} />}
          </div>

          {!isChecked && (
            <div className="sm:col-start-1 sm:row-start-2">
              <NameBank
                activeNumber={activeSlot?.number ?? null}
                names={unplacedNames(names, placements)}
                onPlace={(name) => {
                  if (activeSlot) {
                    place(name, activeSlot.partId);
                  }
                }}
              />
            </div>
          )}

          <div className="sm:col-start-2 sm:row-span-2 sm:row-start-1">
            <DiagramSlots
              activePartId={activeSlot?.partId ?? null}
              checked={checked}
              onSelect={select}
              placements={placements}
              slots={slots}
            />
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <ActivityTextAlternative>
          {title}.{" "}
          {t("{count, plural, one {# numbered spot} other {# numbered spots}} to label.", {
            count: slots.length,
          })}
        </ActivityTextAlternative>
      </ActivityCanvas>
    </ActivityDragDrop>
  );
}

/**
 * Names go on numbered spots of a checked drawing, like the chambers of the heart. The learner
 * taps a spot and a name, or drags a name onto a spot or its pin. Once checked, every spot shows
 * the right name next to theirs, with the writer's feedback for a likely mix-up.
 */
export function LabeledDiagramActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: LabeledDiagramProps) {
  const { fields } = content;
  const { diagramId } = fields;

  if (!isDiagramId(diagramId)) {
    return null;
  }

  return (
    <DiagramBoard
      answer={answer}
      fields={{ ...fields, diagramId }}
      isChecked={phase === "checked"}
      labelId={labelId}
      onAnswerChange={onAnswerChange}
    />
  );
}
