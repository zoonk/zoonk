"use client";

import { useExtracted } from "next-intl";
import { type BuildAtom } from "./molecule-model";
import { useElementName } from "./use-element-name";

export function useAtomName(): (atom: BuildAtom) => string {
  const t = useExtracted();
  const nameOf = useElementName();

  return (atom) =>
    t("{element} {number}", {
      element: nameOf(atom.element),
      number: atom.id.replace(/^\D+/u, ""),
    });
}
