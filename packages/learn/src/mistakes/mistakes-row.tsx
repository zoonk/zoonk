"use client";

import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";

/** The mistakes notebook as a row of a list, with how many are left to fix at its end; nothing at zero. */
export function MistakesRow({ count, href }: { count: number; href: string }) {
  const t = useExtracted();

  if (count === 0) {
    return null;
  }

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <KindTile kind="mistakes" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Mistakes notebook")}</ListRowTitle>
        <ListRowDescription>{t("Redo what you got wrong")}</ListRowDescription>
      </ListRowContent>
      <ListRowTrailing>
        <span aria-hidden="true">{count}</span>
        <span className="sr-only">
          {t("{count, plural, one {# to fix} other {# to fix}}", { count })}
        </span>
      </ListRowTrailing>
    </ListRowLink>
  );
}
