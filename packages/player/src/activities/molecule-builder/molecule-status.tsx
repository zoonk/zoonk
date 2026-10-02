"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type Build, atomFill } from "./molecule-model";
import { useAtomName } from "./use-atom-name";

/** Where the build stands, from each atom's valence: what's still open or overfilled. */
function useBuildState(build: Build) {
  const t = useExtracted();
  const nameOf = useAtomName();
  const over = build.atoms.find((atom) => atomFill(build, atom) === "over");
  const open = build.atoms.filter((atom) => atomFill(build, atom) === "open").length;

  if (build.atoms.length === 0) {
    return { text: t("Tap an element to add its first atom."), tone: "muted" as const };
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

export function MoleculeStatus({
  build,
  isChecked,
  selectedName,
}: {
  build: Build;
  isChecked: boolean;
  selectedName: string | null;
}) {
  const t = useExtracted();
  const state = useBuildState(build);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm leading-snug">
      <p
        className={cn(
          state.tone === "muted" && "text-muted-foreground",
          state.tone === "destructive" && "text-destructive font-medium",
          state.tone === "success" && "text-success font-medium",
        )}
      >
        {state.text}
      </p>

      {!isChecked && build.atoms.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {selectedName
            ? t(
                "{atom} is selected. Tap another atom to bond them, or an element to add one bonded to it.",
                { atom: selectedName },
              )
            : t("Tap an atom to select it.")}
        </p>
      )}
    </div>
  );
}
