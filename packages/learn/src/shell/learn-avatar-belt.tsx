"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useBeltName } from "../_utils/use-belt-name";

/**
 * The learner's belt as a small dot on the account avatar, as in the rest of the app. The avatar
 * (`children`) keeps its own menu; the dot only says the belt.
 */
export function LearnAvatarBelt({
  children,
  color,
}: {
  children: React.ReactNode;
  /** Null before any learning: no belt yet, no dot. */
  color: BeltColor | null;
}) {
  const beltName = useBeltName();

  return (
    <span className="relative inline-flex">
      {children}
      {color && (
        <BeltIndicator
          className="outline-background pointer-events-none absolute -right-0.5 -bottom-0.5 outline-2"
          color={color}
          label={beltName(color)}
          size="sm"
        />
      )}
    </span>
  );
}
