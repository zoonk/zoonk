"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useBeltName } from "../_utils/use-belt-name";

export function LearnAvatarBelt({
  children,
  color,
}: {
  children: React.ReactNode;
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
