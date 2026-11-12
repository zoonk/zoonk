"use client";

import { Flag, isFlagCode } from "@zoonk/ui/components/language-flag";
import { safeAsync } from "@zoonk/utils/error";
import { useRef, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { StatusRegion } from "../_components/status-region";
import { OfferButton, OfferCard, OfferTile } from "./tutor-offer-card";

export function FlagTile({ fallback, flag }: { fallback: React.ReactNode; flag: string | null }) {
  return isFlagCode(flag) ? (
    <Flag className="w-4.5" code={flag} />
  ) : (
    <OfferTile>{fallback}</OfferTile>
  );
}

/**
 * A card that saves one setting. Nothing is saved before the tap. `saved` is the setting having
 * this card's value, so a later card's value takes over, and `onApply` resolves once the setting
 * says it. Apply is a form, so React sends a tap made before the page hydrates once it does.
 */
export function ApplyOfferCard({
  applyLabel,
  description,
  onApply,
  saved,
  savedText,
  tile,
  title,
}: {
  applyLabel: string;
  description: React.ReactNode;
  onApply: () => Promise<boolean>;
  saved: boolean;
  savedText: string;
  tile: React.ReactNode;
  title: string;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const apply = () => {
    setFailed(false);

    startTransition(async () => {
      const { data: applied } = await safeAsync(onApply);
      setFailed(!applied);

      if (applied) {
        // The button leaves with the save, so focus stays on the card that says how it went.
        cardRef.current?.focus();
      }
    });
  };

  return (
    <OfferCard description={saved ? null : description} ref={cardRef} tile={tile} title={title}>
      <StatusRegion className="text-muted-foreground text-sm">{saved && savedText}</StatusRegion>

      {!saved && (
        <form action={apply}>
          <OfferButton busy={isPending} type="submit">
            {applyLabel}
          </OfferButton>
        </form>
      )}

      {failed && <ChangeSaveError />}
    </OfferCard>
  );
}
