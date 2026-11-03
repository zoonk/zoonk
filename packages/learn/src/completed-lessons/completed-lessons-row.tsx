"use client";

import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";

export function CompletedLessonsRow({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <KindDot kind="lesson" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Completed lessons")}</ListRowTitle>
        <ListRowDescription>{t("Go back to any lesson you've finished")}</ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}
