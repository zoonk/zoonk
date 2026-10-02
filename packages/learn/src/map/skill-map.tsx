"use client";

import { type MapSkill } from "@zoonk/core/view-models/map/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useState } from "react";
import { useStateLabel } from "../content/use-state-label";
import { toSkillMapEdges, toSkillMapLayers } from "./skill-map-layers";
import { FADING_OUTLINE, STATE_SURFACES, SkillStateIcon } from "./skill-state";
import { useMapEdgePaths } from "./use-map-edge-paths";

const ROOT_ID = "map-root";

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

function findTarget({
  buttons,
  index,
  key,
}: {
  buttons: HTMLButtonElement[];
  index: number;
  key: string;
}) {
  if (NEXT_KEYS.has(key)) {
    return buttons[Math.min(index + 1, buttons.length - 1)];
  }

  if (PREVIOUS_KEYS.has(key)) {
    return buttons[Math.max(index - 1, 0)];
  }

  if (key === "Home") {
    return buttons[0];
  }

  return key === "End" ? buttons.at(-1) : undefined;
}

/** Arrow keys walk the map's skills in reading order; Home and End jump to its ends. */
function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
  const map = event.currentTarget.closest("[data-skill-map]");
  const buttons = [...(map?.querySelectorAll<HTMLButtonElement>("[data-skill-node]") ?? [])];
  const index = buttons.indexOf(event.currentTarget);
  const target = findTarget({ buttons, index, key: event.key });

  if (target && index !== -1) {
    event.preventDefault();
    target.focus();
  }
}

function SkillNode({
  detailId,
  needs,
  onKeyDown,
  onToggle,
  ref,
  selected,
  skill,
}: {
  detailId: string;
  /** Names of the skills on this map it builds on, which the lines show. */
  needs: string[];
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onToggle: () => void;
  ref: (element: HTMLElement | null) => void;
  selected: boolean;
  skill: MapSkill;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const stateLabel = useStateLabel();

  const description = [
    stateLabel(skill),
    skill.fading && t("fading"),
    needs.length > 0 &&
      t("builds on {skills}", { skills: format.list(needs, { type: "conjunction" }) }),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    // The card underneath keeps links drawn behind a node from showing through its tint. Nodes are
    // rounded rectangles, not pills, since longer skill names take two or three lines.
    <div className="bg-card rounded-2xl" ref={ref} role="listitem">
      <button
        aria-controls={selected ? detailId : undefined}
        aria-expanded={selected}
        className={cn(
          "focus-visible:ring-ring/50 flex min-h-11 max-w-64 items-center rounded-2xl border px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px]",
          STATE_SURFACES[skill.state],
          skill.fading ? FADING_OUTLINE : "border-border",
          selected && "ring-foreground ring-2",
        )}
        data-skill-node=""
        data-state={skill.state}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        type="button"
      >
        {/* The state icon stays on the name's first line. */}
        <span className="flex items-start gap-1.5">
          <LineMarker>
            <SkillStateIcon state={skill.state} />
          </LineMarker>
          <span className="line-clamp-3">{skill.name}</span>
        </span>
        <span className="sr-only">{description}</span>
      </button>
    </div>
  );
}

/**
 * A map drawn from the skill graph: the subject on top and its skills below, each one row under
 * the skills it needs, linked by lines. Each skill shows its mastery by shape and tone; tapping
 * one opens its details below the map. The skills are a list of buttons, so screen readers and
 * keyboards (Tab or the arrow keys) reach every one in order.
 */
export function SkillMap({
  label,
  renderDetail,
  rootTitle,
  skills,
}: {
  /** Names the list of skills for screen readers. */
  label: string;
  renderDetail: (skill: MapSkill) => React.ReactNode;
  rootTitle: string;
  skills: readonly MapSkill[];
}) {
  const detailId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const layers = toSkillMapLayers(skills);
  const edges = toSkillMapEdges({ rootId: ROOT_ID, skills });
  const { containerRef, paths, register } = useMapEdgePaths(edges);
  const selected = skills.find((skill) => skill.skillId === selectedId) ?? null;
  const names = new Map(skills.map((skill) => [skill.skillId, skill.name]));

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && selectedId) {
      setSelectedId(null);
      return;
    }

    moveFocus(event);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative" ref={containerRef}>
        <svg
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          {paths.map((edge) => (
            <path
              d={edge.path}
              fill="none"
              key={edge.key}
              stroke="currentColor"
              strokeWidth={1.25}
            />
          ))}
        </svg>

        <div className="relative flex flex-col items-center gap-6">
          <span
            className="bg-primary text-primary-foreground max-w-60 rounded-2xl px-4 py-2 text-center text-sm font-semibold"
            ref={register(ROOT_ID)}
          >
            {rootTitle}
          </span>

          <div
            aria-label={label}
            className="flex w-full flex-col items-center gap-6"
            data-skill-map=""
            role="list"
          >
            {layers.map((row) => (
              <div
                className="flex flex-wrap justify-center gap-x-2 gap-y-3"
                key={row[0]?.skillId ?? "row"}
              >
                {row.map((skill) => (
                  <SkillNode
                    detailId={detailId}
                    key={skill.skillId}
                    needs={skill.prerequisiteIds.flatMap((id) => names.get(id) ?? [])}
                    onKeyDown={onKeyDown}
                    onToggle={() =>
                      setSelectedId((current) => (current === skill.skillId ? null : skill.skillId))
                    }
                    ref={register(skill.skillId)}
                    selected={skill.skillId === selectedId}
                    skill={skill}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div aria-live="polite" id={detailId}>
        {selected && renderDetail(selected)}
      </div>
    </div>
  );
}
