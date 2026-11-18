"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type Build, MAX_ATOMS, atomFill } from "./molecule-model";
import { useAtomName } from "./use-atom-name";

function useBuildState(build: Build) {
  const t = useExtracted();
  const nameOf = useAtomName();
  const over = build.atoms.find((atom) => atomFill(build, atom) === "over");
  const open = build.atoms.filter((atom) => atomFill(build, atom) === "open").length;

  if (build.atoms.length === 0) {
    return { text: t("Pick an element to start your molecule."), tone: "muted" as const };
  }

  if (over) {
    return {
      text: t("{atom} has more bonds than it can make.", { atom: nameOf(over) }),
      tone: "destructive" as const,
    };
  }

  if (open > 0) {
    return {
      text: t(
        "{count, plural, one {# atom has open bonds, shown as dots.} other {# atoms have open bonds, shown as dots.}}",
        { count: open },
      ),
      tone: "muted" as const,
    };
  }

  return { text: t("Every atom has all its bonds."), tone: "success" as const };
}

function MoleculeSelectionGuidance({
  build,
  elements,
  selectedName,
}: {
  build: Build;
  elements: readonly string[];
  selectedName: string | null;
}) {
  const t = useExtracted();
  const nameOf = useAtomName();
  const pick = t("Pick an atom to select it.");

  const bond = (atom: string) =>
    t(
      "{atom} is selected. Pick another atom to bond them, or an element to add one bonded to it.",
      { atom },
    );

  const variants = new Set([
    pick,
    ...elements.map((element) => bond(nameOf({ element, id: String(MAX_ATOMS) }))),
    ...build.atoms.map((atom) => bond(nameOf(atom))),
  ]);

  return (
    <div className="text-muted-foreground grid grid-cols-1 text-xs wrap-anywhere tabular-nums">
      {/* Size the same grid cell with every possible hint before the learner selects an atom. */}
      {[...variants].map((text) => (
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 before:content-[attr(data-label)]"
          data-label={text}
          key={text}
        />
      ))}
      <p className="col-start-1 row-start-1">
        {selectedName ? bond(selectedName) : build.atoms.length > 0 && pick}
      </p>
    </div>
  );
}

export function MoleculeStatus({
  build,
  elements,
  isChecked,
  selectedName,
}: {
  build: Build;
  elements: readonly string[];
  isChecked: boolean;
  selectedName: string | null;
}) {
  const state = useBuildState(build);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm leading-snug">
      <p
        className={cn(
          state.tone === "muted" && "text-muted-foreground",
          state.tone === "destructive" && "text-destructive-text font-medium",
          state.tone === "success" && "text-success-text font-medium",
        )}
      >
        {state.text}
      </p>

      {!isChecked && (
        <MoleculeSelectionGuidance build={build} elements={elements} selectedName={selectedName} />
      )}
    </div>
  );
}
