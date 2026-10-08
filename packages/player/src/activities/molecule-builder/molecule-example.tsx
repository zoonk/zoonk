"use client";

import { type ElementCounts } from "@zoonk/core/library/activities/chemistry";
import { findMoleculeStructure } from "@zoonk/core/library/activities/molecule-structure";
import { useExtracted } from "next-intl";
import { MoleculeCanvas } from "./molecule-canvas";
import { layoutBuild } from "./molecule-layout";
import { bondTotal } from "./molecule-model";
import { useAtomName } from "./use-atom-name";
import { useBuildDescription } from "./use-build-description";

/** One complete build for the formula, found by code, shown after the check to compare with. */
export function MoleculeExample({ target }: { target: ElementCounts }) {
  const t = useExtracted();
  const nameOf = useAtomName();
  const describe = useBuildDescription();
  const structure = findMoleculeStructure(target);

  if (!structure) {
    return null;
  }

  const description = describe(structure);

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <p className="text-sm font-medium">{t("One correct build")}</p>

      <MoleculeCanvas
        atomLabel={nameOf}
        build={structure}
        className="max-w-[260px]"
        description={description}
        fit
        layout={layoutBuild({ atoms: structure.atoms, bonds: structure.bonds })}
        selectedId={null}
      />

      <p className="text-muted-foreground text-sm">
        {t("{count, plural, one {# bond} other {# bonds}} in all, counting a double bond as two.", {
          count: bondTotal(structure),
        })}
      </p>
    </div>
  );
}
