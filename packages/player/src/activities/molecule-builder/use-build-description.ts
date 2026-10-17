"use client";

import { useExtracted } from "next-intl";
import { type Build } from "./molecule-model";
import { useAtomName } from "./use-atom-name";

/** A build in words: each bond with its order, then any atom with no bonds at all. */
export function useBuildDescription(): (build: Build) => string {
  const t = useExtracted();
  const nameOf = useAtomName();

  return (build) => {
    const named = (id: string) => {
      const atom = build.atoms.find((item) => item.id === id);
      return atom ? nameOf(atom) : id;
    };

    const bonds = build.bonds.map((bond) =>
      t(
        "{first} and {second}: {order, select, 1 {single bond} 2 {double bond} other {triple bond}}.",
        { first: named(bond.from), order: String(bond.order), second: named(bond.to) },
      ),
    );

    const loose = build.atoms
      .filter((atom) => !build.bonds.some((bond) => bond.from === atom.id || bond.to === atom.id))
      .map((atom) => t("{atom} has no bonds.", { atom: nameOf(atom) }));

    return [...bonds, ...loose].join(" ");
  };
}
