"use client";

import { seededShuffle } from "@zoonk/utils/seeded-random";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivityDragDrop } from "../_components/activity-drag-drop";
import { type ActivityRendererProps } from "../activity-renderer";
import { DiagramSlots } from "./diagram-slots";
import {
  type Placements,
  assignmentAnswer,
  diagramSlots,
  mixUpFeedback,
  nextEmptySlot,
  placeName,
  removeName,
  unplacedNames,
} from "./labeled-diagram-model";
import { NameBank } from "./name-bank";
import { SpotNumber } from "./spot-number";

type LabeledDiagramProps = ActivityRendererProps<"labeledDiagram">;
type Fields = LabeledDiagramProps["content"]["fields"];

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
  fields: Fields;
  isChecked: boolean;
  labelId: string;
  onAnswerChange: LabeledDiagramProps["onAnswerChange"];
}) {
  const t = useExtracted();
  const slots = diagramSlots(fields.parts);
  const [placements, setPlacements] = useState(() => initialPlacements(answer));

  const [activeKey, setActiveKey] = useState(() =>
    nextEmptySlot({ after: null, placements, slots }),
  );

  const [announcement, setAnnouncement] = useState("");

  const names = seededShuffle(
    [...fields.parts.map((part) => part.label), ...fields.distractors],
    fields.parts.map((part) => part.part).join(","),
  );

  const activeSlot = isChecked ? undefined : slots.find((slot) => slot.key === activeKey);

  function update(next: Placements, after: string | null) {
    setPlacements(next);
    setActiveKey(nextEmptySlot({ after, placements: next, slots }));
    onAnswerChange(assignmentAnswer(slots, next));
  }

  function place(name: string, key: string) {
    update(placeName({ key, name, placements }), key);
    setAnnouncement(t("{name} on spot {number}.", { name, number: key }));
  }

  function select(key: string) {
    const name = placements[key];

    if (!name) {
      setActiveKey(key);
      return;
    }

    const next = removeName(placements, key);
    setPlacements(next);
    setActiveKey(key);
    onAnswerChange(assignmentAnswer(slots, next));
    setAnnouncement(t("{name} taken off.", { name }));
  }

  const checked = isChecked
    ? new Map(
        slots.map((slot) => [
          slot.key,
          mixUpFeedback({
            correct: slot.label,
            mixUps: fields.mixUps,
            placed: placements[slot.key],
          }),
        ]),
      )
    : null;

  return (
    <ActivityDragDrop
      onDrop={(name, target) => {
        if (!isChecked) {
          place(name, target.replace(/^slot:/u, ""));
        }
      }}
    >
      <ActivityCanvas className="gap-4" labelId={labelId}>
        {!isChecked && (
          <NameBank
            activeNumber={activeSlot?.number ?? null}
            names={unplacedNames(names, placements)}
            onPlace={(name) => {
              if (activeSlot) {
                place(name, activeSlot.key);
              }
            }}
          />
        )}

        <DiagramSlots
          activeKey={activeSlot?.key ?? null}
          checked={checked}
          onSelect={select}
          placements={placements}
          slots={slots}
        />

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <ActivityTextAlternative>
          {t(
            "{count, plural, one {# numbered spot} other {# numbered spots}} on the picture to label.",
            { count: slots.length },
          )}
        </ActivityTextAlternative>
      </ActivityCanvas>
    </ActivityDragDrop>
  );
}

function DiagramKey({ fields, labelId }: { fields: Fields; labelId: string }) {
  const t = useExtracted();

  return (
    <ActivityCanvas labelId={labelId}>
      <ol aria-label={t("What each number shows")} className="flex flex-col gap-1.5">
        {diagramSlots(fields.parts).map((slot) => (
          <li className="flex min-h-8 items-center gap-3 text-sm" key={slot.key}>
            <SpotNumber number={slot.number} state="filled" />
            <span className="font-medium">{slot.label}</span>
          </li>
        ))}
      </ol>
    </ActivityCanvas>
  );
}

export function LabeledDiagramActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: LabeledDiagramProps) {
  if (phase === "explore") {
    return <DiagramKey fields={content.fields} labelId={labelId} />;
  }

  return (
    <DiagramBoard
      answer={answer}
      fields={content.fields}
      isChecked={phase === "checked"}
      labelId={labelId}
      onAnswerChange={onAnswerChange}
    />
  );
}
