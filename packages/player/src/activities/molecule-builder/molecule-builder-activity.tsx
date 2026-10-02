"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import {
  isCompleteMolecule,
  parseMolecularFormula,
  valenceOf,
} from "@zoonk/core/library/activities/chemistry";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { useReducedMotion } from "../_utils/use-reduced-motion";
import { type ActivityRendererProps } from "../activity-renderer";
import { MoleculeCanvas } from "./molecule-canvas";
import { MoleculeExample } from "./molecule-example";
import {
  type Build,
  bondTotal,
  bondsUsed,
  builtCounts,
  formulaText,
  moleculeAnswer,
} from "./molecule-model";
import { MoleculeElements, MoleculeTools } from "./molecule-palette";
import { MoleculeStatus } from "./molecule-status";
import { useAtomName } from "./use-atom-name";
import { useBuildDescription } from "./use-build-description";
import { type BuilderChange, useMoleculeBuilder } from "./use-molecule-builder";
import { useTweenedLayout } from "./use-tweened-layout";

type MoleculeProps = ActivityRendererProps<"moleculeBuilder">;

/** Past this, a build is a pile of atoms, not a molecule a lesson would ask for. */
const MAX_ATOMS = 16;

function answerFor(content: MoleculeProps["content"], build: Build): ActivityAnswer | null {
  if (content.check.kind === "numeric") {
    return build.bonds.length === 0 ? null : { kind: "numeric", value: bondTotal(build) };
  }

  return moleculeAnswer(build);
}

/** What a change did, in words, for the live region. */
function useChangeAnnouncement() {
  const t = useExtracted();
  const nameOf = useAtomName();

  return ({ next, previous, what }: { next: Build; previous: Build; what: BuilderChange }) => {
    const atoms = [...previous.atoms, ...next.atoms];

    const named = (id: string | null) => {
      const atom = atoms.find((item) => item.id === id);
      return atom ? nameOf(atom) : "";
    };

    if (what.kind === "added") {
      return what.bondTo
        ? t("Added {atom}, bonded to {other}.", {
            atom: named(what.atom),
            other: named(what.bondTo),
          })
        : t("Added {atom}.", { atom: named(what.atom) });
    }

    if (what.kind === "bonded") {
      return t(
        "{first} and {second}: {order, select, 0 {no bond} 1 {single bond} 2 {double bond} other {triple bond}}.",
        { first: named(what.first), order: String(what.order), second: named(what.second) },
      );
    }

    if (what.kind === "removed") {
      return t("Removed {atom}.", { atom: named(what.atom) });
    }

    if (what.kind === "undone") {
      return t("Undone.");
    }

    return what.atom ? t("{atom} selected.", { atom: named(what.atom) }) : t("Nothing selected.");
  };
}

/**
 * Atoms joined until every bond is filled, like carbon dioxide. The learner adds atoms from the
 * palette (bonded to the selected atom, if any) and taps two atoms to step the bond between them.
 * Dots show each atom's open bonds; code knows every element's valence and grades any complete
 * structure with the formula's atoms. After the check, one correct build appears when needed.
 */
export function MoleculeBuilderActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: MoleculeProps) {
  const t = useExtracted();
  const reducedMotion = useReducedMotion();
  const nameOf = useAtomName();
  const describe = useBuildDescription();
  const [announcement, setAnnouncement] = useState("");
  const { elements, formula } = content.fields;
  const target = parseMolecularFormula(formula) ?? {};
  const order = Object.keys(target);
  const announce = useChangeAnnouncement();

  const builder = useMoleculeBuilder({
    answer,
    onBuildChange: (change) => {
      setAnnouncement(announce(change));

      if (content.check.kind !== "choice") {
        onAnswerChange(answerFor(content, change.next));
      }
    },
  });

  const { build, layout, selectedId } = builder.state;
  const shown = useTweenedLayout(layout, reducedMotion);
  const isChecked = phase === "checked";
  const selected = build.atoms.find((atom) => atom.id === selectedId);
  const isRight = isCompleteMolecule(build, target);

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
        <ActivityCanvasLabel className="text-sm">
          {t("Target: {formula}", { formula: formulaText(target, order) })}
        </ActivityCanvasLabel>

        {build.atoms.length > 0 && (
          <ActivityCanvasLabel className="text-sm">
            {t("Built: {formula}", { formula: formulaText(builtCounts(build), order) })}
          </ActivityCanvasLabel>
        )}
      </div>

      <div className="bg-background/60 rounded-2xl bg-[radial-gradient(var(--border)_1px,transparent_1.2px)] bg-size-[18px_18px]">
        <MoleculeCanvas
          atomLabel={(atom) =>
            t("{atom}: {used} of {valence} bonds", {
              atom: nameOf(atom),
              used: String(bondsUsed(build, atom.id)),
              valence: String(valenceOf(atom.element)),
            })
          }
          build={build}
          layout={shown}
          onAtomPress={isChecked ? undefined : builder.press}
          selectedId={isChecked ? null : selectedId}
        />
      </div>

      <div className="flex items-start gap-3">
        <MoleculeStatus
          build={build}
          isChecked={isChecked}
          selectedName={selected ? nameOf(selected) : null}
        />

        {!isChecked && (
          <MoleculeTools
            canUndo={builder.canUndo}
            onRemove={builder.remove}
            onUndo={builder.undo}
            selectedName={selected ? nameOf(selected) : null}
          />
        )}
      </div>

      {!isChecked && (
        <MoleculeElements
          canAdd={build.atoms.length < MAX_ATOMS}
          elements={elements}
          onAdd={builder.add}
          selectedName={selected ? nameOf(selected) : null}
        />
      )}

      {isChecked && (content.check.kind !== "interaction" || !isRight) && (
        <MoleculeExample target={target} />
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ActivityTextAlternative>
        {t("Build {formula}.", { formula: formulaText(target, order) })} {describe(build)}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
