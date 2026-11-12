"use client";

import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";

export function CompletedLessonsRow({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <ListRowLink href={href}>
      <ListRowLeading className="w-4 justify-center">
        <KindDot kind="lesson" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Completed lessons")}</ListRowTitle>
      </ListRowContent>
    </ListRowLink>
  );
}
