"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";

function MistakesRowDescription({ availability }: { availability: MistakeAvailability }) {
  const t = useExtracted();
  const { ready, tomorrow } = availability;

  if (ready > 0 && tomorrow > 0) {
    return t(
      "{ready, plural, =0 {# ready to practice} one {# ready to practice} other {# ready to practice}} · {tomorrow, plural, =0 {# available tomorrow} one {# available tomorrow} other {# available tomorrow}}",
      { ready, tomorrow },
    );
  }

  return ready > 0 ? t("Redo what you got wrong") : t("Today's mistakes return tomorrow");
}

/** The mistakes notebook as a row of a list, with how many are left to fix at its end; nothing at zero. */
export function MistakesRow({
  availability,
  href,
}: {
  availability: MistakeAvailability;
  href: string;
}) {
  const t = useExtracted();
  const { ready, tomorrow } = availability;
  const count = ready + tomorrow;

  if (count === 0) {
    return null;
  }

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <KindDot kind="mistakes" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Mistakes notebook")}</ListRowTitle>
        <ListRowDescription>
          <MistakesRowDescription availability={availability} />
        </ListRowDescription>
      </ListRowContent>
      <ListRowTrailing>
        <span aria-hidden="true">{ready > 0 ? ready : tomorrow}</span>
        {!(ready > 0 && tomorrow > 0) && (
          <span className="sr-only">
            {ready > 0
              ? t(
                  "{count, plural, =0 {# ready to practice} one {# ready to practice} other {# ready to practice}}",
                  { count: ready },
                )
              : t(
                  "{count, plural, =0 {# available tomorrow} one {# available tomorrow} other {# available tomorrow}}",
                  { count: tomorrow },
                )}
          </span>
        )}
      </ListRowTrailing>
    </ListRowLink>
  );
}
