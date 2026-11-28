"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { NotebookPenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";

export function MistakesRow({
  availability,
  href,
}: {
  availability: MistakeAvailability;
  href: string;
}) {
  const t = useExtracted();
  const { ready } = availability;

  if (ready === 0) {
    return null;
  }

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <ListRowIcon>
          <NotebookPenIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{t("Mistakes notebook")}</ListRowTitle>
          <ListRowDescription>{t("Redo what you got wrong")}</ListRowDescription>
        </ListRowContent>
        <ListRowTrailing>
          <span aria-hidden="true">{ready}</span>
          <span className="sr-only">
            {t(
              "{count, plural, =0 {# ready to practice} one {# ready to practice} other {# ready to practice}}",
              { count: ready },
            )}
          </span>
        </ListRowTrailing>
      </ListRowBody>
    </ListRowLink>
  );
}
