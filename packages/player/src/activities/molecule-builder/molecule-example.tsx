"use client";

import { type ElementCounts } from "@zoonk/core/library/activities/chemistry";
import { findMoleculeStructure } from "@zoonk/core/library/activities/molecule-structure";
import { useExtracted } from "next-intl";
import { ActivityCanvas, ActivityCanvasLabel } from "../_components/activity-canvas";
import { MoleculeCanvas } from "./molecule-canvas";
import { layoutBuild } from "./molecule-layout";
import { type Build, bondTotal } from "./molecule-model";
import { useAtomName } from "./use-atom-name";
import { useBuildDescription } from "./use-build-description";

/** A complete build drawn to fit, with its bonds counted. */
function MoleculeStructure({ structure }: { structure: Build }) {
  const t = useExtracted();
  const nameOf = useAtomName();
  const describe = useBuildDescription();

  return (
    <>
      <MoleculeCanvas
        atomLabel={nameOf}
        build={structure}
        className="max-w-[260px]"
        description={describe(structure)}
        fit
        layout={layoutBuild({ atoms: structure.atoms, bonds: structure.bonds })}
        selectedId={null}
      />

      <p className="text-muted-foreground text-sm">
        {t("{count, plural, one {# bond} other {# bonds}} in all, counting a double bond as two.", {
          count: bondTotal(structure),
        })}
      </p>
    </>
  );
}

/** One complete build for the formula, found by code, shown after the check to compare with. */
export function MoleculeExample({ target }: { target: ElementCounts }) {
  const t = useExtracted();
  const structure = findMoleculeStructure(target);

  if (!structure) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <p className="text-sm font-medium">{t("One correct build")}</p>
      <MoleculeStructure structure={structure} />
    </div>
  );
}

/** The molecule explored on an explanation screen: one complete build of it, nothing to build. */
export function ExploredMolecule({
  formula,
  labelId,
  target,
}: {
  formula: string;
  labelId: string;
  target: ElementCounts;
}) {
  const structure = findMoleculeStructure(target);

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityCanvasLabel className="text-sm">{formula}</ActivityCanvasLabel>
      {structure && <MoleculeStructure structure={structure} />}
    </ActivityCanvas>
  );
}
