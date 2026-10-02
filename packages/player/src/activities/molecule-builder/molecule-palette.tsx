"use client";

import { valenceOf } from "@zoonk/core/library/activities/chemistry";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Trash, Undo2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { elementStyle } from "./element-style";
import { useElementName } from "./use-element-name";

function ElementSwatch({ element }: { element: string }) {
  const style = elementStyle(element);

  return (
    <svg aria-hidden="true" className="size-7 shrink-0" viewBox="0 0 28 28">
      <circle
        className={cn(style.fill, "stroke-foreground/25")}
        cx={14}
        cy={14}
        r={13}
        strokeWidth={1}
      />
      <text
        className={cn(style.text, "font-bold")}
        dominantBaseline="central"
        fontSize={12}
        textAnchor="middle"
        x={14}
        y={14}
      >
        {element}
      </text>
    </svg>
  );
}

/**
 * The elements to add, each with how many bonds it makes. With an atom selected, a new atom
 * arrives already bonded to it.
 */
export function MoleculeElements({
  canAdd,
  elements,
  onAdd,
  selectedName,
}: {
  canAdd: boolean;
  elements: readonly string[];
  onAdd: (element: string) => void;
  selectedName: string | null;
}) {
  const t = useExtracted();
  const nameOf = useElementName();

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
      {elements.map((element) => (
        <button
          aria-label={
            selectedName
              ? t("Add {element} bonded to {atom}", {
                  atom: selectedName,
                  element: nameOf(element),
                })
              : t("Add {element}", { element: nameOf(element) })
          }
          className="bg-background hover:bg-accent focus-visible:ring-ring/50 flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-2 outline-none focus-visible:ring-[3px] disabled:opacity-50"
          disabled={!canAdd}
          key={element}
          onClick={() => onAdd(element)}
          type="button"
        >
          <ElementSwatch element={element} />
          <span className="text-muted-foreground text-[13px] whitespace-nowrap">
            {t("{count, plural, one {# bond} other {# bonds}}", { count: valenceOf(element) })}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Undo the last change, or remove the selected atom with its bonds. */
export function MoleculeTools({
  canUndo,
  onRemove,
  onUndo,
  selectedName,
}: {
  canUndo: boolean;
  onRemove: () => void;
  onUndo: () => void;
  selectedName: string | null;
}) {
  const t = useExtracted();

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        aria-label={t("Undo")}
        className="size-11 rounded-2xl"
        disabled={!canUndo}
        onClick={onUndo}
        size="icon-lg"
        variant="outline"
      >
        <Undo2 aria-hidden="true" />
      </Button>

      <Button
        aria-label={
          selectedName ? t("Remove {atom}", { atom: selectedName }) : t("Remove the selected atom")
        }
        className="size-11 rounded-2xl"
        disabled={!selectedName}
        onClick={onRemove}
        size="icon-lg"
        variant="outline"
      >
        <Trash aria-hidden="true" />
      </Button>
    </div>
  );
}
